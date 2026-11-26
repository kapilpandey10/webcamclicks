#!/usr/bin/env python3
"""Build the real Kathmandu map for Kathmandu Streets from OpenStreetMap.

Downloads roads, buildings, rivers, ponds, parks and named places for a
bounding box around central Kathmandu from the Overpass API, projects them to
game metres (x = east, z = south, origin at ORIGIN below, 1 unit = 1 m) and
writes one compact JSON file the game loads:

    js/games/kathmandu/data/kathmandu-map.json

Usage:
    python3 scripts/build-kathmandu-map.py                 # download + build
    python3 scripts/build-kathmandu-map.py --in raw.json   # build from a saved Overpass response
    python3 scripts/build-kathmandu-map.py --save raw.json # keep the raw download too

Map data (c) OpenStreetMap contributors, ODbL 1.0. The game must credit it.
"""
import argparse
import json
import math
import os
import sys
import urllib.parse
import urllib.request

# Ratna Park / Tundikhel: the middle of the old city.
ORIGIN = (27.7041, 85.3145)
# south, west, north, east. Covers Kalanki..Koteshwor and Balkhu..Maharajgunj (inside the Ring Road).
BBOX = (27.6780, 85.2780, 27.7420, 85.3500)

MIRRORS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
]

ROAD_CLASSES = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified',
                'residential', 'living_street', 'service', 'pedestrian', 'track']
# default carriageway width in metres when OSM has no width / lanes
ROAD_WIDTH = {'motorway': 22, 'trunk': 20, 'primary': 14, 'secondary': 11, 'tertiary': 9,
              'unclassified': 7, 'residential': 6, 'living_street': 5, 'service': 4.5,
              'pedestrian': 6, 'track': 4}

M_LAT = 111320.0
M_LON = 111320.0 * math.cos(math.radians(ORIGIN[0]))


def proj(lat, lon):
    return (round((lon - ORIGIN[1]) * M_LON, 1), round(-(lat - ORIGIN[0]) * M_LAT, 1))


def query():
    s, w, n, e = BBOX
    b = f'{s},{w},{n},{e}'
    return f"""[out:json][timeout:300][maxsize:1073741824];
(
  way["highway"~"^({'|'.join(ROAD_CLASSES)})$"]({b});
  way["building"]({b});
  relation["building"]({b});
  way["waterway"~"^(river|stream|canal)$"]({b});
  way["natural"="water"]({b});
  relation["natural"="water"]({b});
  way["leisure"~"^(park|garden|pitch|stadium)$"]({b});
  way["landuse"~"^(grass|recreation_ground|forest|meadow)$"]({b});
  way["amenity"~"^(hospital|university|college|school|bus_station|parking)$"]({b});
  node["name"]["amenity"~"^(place_of_worship|hospital|bus_station|fuel)$"]({b});
  node["name"]["tourism"~"^(attraction|museum|hotel|viewpoint)$"]({b});
  node["name"]["historic"]({b});
  node["place"~"^(suburb|neighbourhood|quarter)$"]({b});
);
out geom qt;"""


def download(save):
    body = urllib.parse.urlencode({'data': query()}).encode()
    last = None
    for url in MIRRORS:
        try:
            print('downloading from', url, file=sys.stderr)
            req = urllib.request.Request(url, data=body, headers={'User-Agent': 'kathmandu-streets-map-builder'})
            with urllib.request.urlopen(req, timeout=600) as r:
                raw = r.read()
            if save:
                with open(save, 'wb') as f:
                    f.write(raw)
            return json.loads(raw)
        except Exception as ex:  # try the next mirror
            last = ex
            print('  failed:', ex, file=sys.stderr)
    raise SystemExit(f'all Overpass mirrors failed: {last}')


def simplify(pts, tol):
    """Douglas-Peucker on a list of (x, z)."""
    if len(pts) < 3:
        return pts
    ax, az = pts[0]
    bx, bz = pts[-1]
    dx, dz = bx - ax, bz - az
    L = math.hypot(dx, dz) or 1e-9
    best, bi = -1.0, 0
    for i in range(1, len(pts) - 1):
        px, pz = pts[i]
        d = abs((px - ax) * dz - (pz - az) * dx) / L
        if d > best:
            best, bi = d, i
    if best <= tol:
        return [pts[0], pts[-1]]
    return simplify(pts[:bi + 1], tol)[:-1] + simplify(pts[bi:], tol)


def simplify_ring(ring, tol):
    """Douglas-Peucker on a closed ring (no repeated end point): split it at the
    point farthest from the first one, simplify both halves, join them."""
    if len(ring) < 4:
        return ring
    x0, z0 = ring[0]
    far = max(range(len(ring)), key=lambda i: (ring[i][0] - x0) ** 2 + (ring[i][1] - z0) ** 2)
    a = simplify(ring[:far + 1], tol)
    b = simplify(ring[far:] + [ring[0]], tol)
    return a[:-1] + b[:-1]


def area(pts):
    s = 0.0
    for i in range(len(pts)):
        x1, z1 = pts[i]
        x2, z2 = pts[(i + 1) % len(pts)]
        s += x1 * z2 - x2 * z1
    return s / 2


def flat(pts):
    out = []
    for x, z in pts:
        out += [x, z]
    return out


def num(v, default=None):
    try:
        return float(str(v).split(';')[0].replace('m', '').strip())
    except (TypeError, ValueError):
        return default


def ring_of(geom):
    pts = [proj(g['lat'], g['lon']) for g in geom if g]
    if len(pts) > 1 and pts[0] == pts[-1]:
        pts = pts[:-1]
    return pts


def outer_rings(el):
    """Polygons of a way, or the outer rings of a multipolygon relation."""
    if el['type'] == 'way':
        return [ring_of(el.get('geometry', []))]
    rings, chain = [], []
    for m in el.get('members', []):
        if m.get('role') != 'outer' or 'geometry' not in m:
            continue
        seg = ring_of(m['geometry']) if m['geometry'][0] != m['geometry'][-1] else None
        if seg is None:
            rings.append(ring_of(m['geometry']))
        else:
            chain += seg  # good enough for the few split outers in this area
    if len(chain) > 2:
        rings.append(chain)
    return rings


def build(data):
    roads, buildings, water, rivers, green, areas, pois, places = [], [], [], [], [], [], [], []
    for el in data.get('elements', []):
        t = el.get('tags', {})
        name, name_ne = t.get('name:en') or t.get('name', ''), t.get('name:ne', '')
        if el['type'] == 'node':
            p = proj(el['lat'], el['lon'])
            if 'place' in t:
                places.append({'n': name, 'ne': name_ne, 'k': t['place'], 'p': list(p)})
            elif name:
                kind = t.get('historic') or t.get('tourism') or t.get('amenity')
                pois.append({'n': name, 'ne': name_ne, 'k': kind, 'r': t.get('religion', ''), 'p': list(p)})
            continue
        hw = t.get('highway')
        if el['type'] == 'way' and hw in ROAD_CLASSES:
            pts = simplify([proj(g['lat'], g['lon']) for g in el.get('geometry', [])], 0.6)
            if len(pts) < 2:
                continue
            lanes = num(t.get('lanes'))
            width = num(t.get('width')) or (lanes * 3.3 if lanes else ROAD_WIDTH[hw])
            road = {'k': ROAD_CLASSES.index(hw), 'w': round(width, 1), 'p': flat(pts)}
            if name:
                road['n'] = name
            if name_ne:
                road['ne'] = name_ne
            if t.get('oneway') in ('yes', '1', '-1'):
                road['o'] = -1 if t['oneway'] == '-1' else 1
            if t.get('bridge') and t['bridge'] != 'no':
                road['b'] = 1
            if t.get('tunnel') and t['tunnel'] != 'no':
                road['t'] = 1
            if lanes:
                road['l'] = int(lanes)
            road['id'] = el['id']
            roads.append(road)
            continue
        if 'building' in t:
            levels = num(t.get('building:levels'))
            h = num(t.get('height')) or (levels * 3.0 if levels else None)
            for ring in outer_rings(el):
                ring = simplify_ring(ring, 0.35)
                if len(ring) < 3 or abs(area(ring)) < 6:
                    continue
                b = {'p': flat(ring)}
                if h:
                    b['h'] = round(h, 1)
                kind = t['building']
                if kind not in ('yes', 'house', 'residential'):
                    b['k'] = kind
                if name:
                    b['n'] = name
                buildings.append(b)
            continue
        if t.get('waterway') in ('river', 'stream', 'canal') and el['type'] == 'way':
            pts = simplify([proj(g['lat'], g['lon']) for g in el.get('geometry', [])], 1.0)
            rivers.append({'n': name, 'ne': name_ne, 'k': t['waterway'], 'w': num(t.get('width'), 30 if t['waterway'] == 'river' else 6), 'p': flat(pts)})
            continue
        polys = outer_rings(el)
        if t.get('natural') == 'water':
            for ring in polys:
                if len(ring) >= 3:
                    water.append({'n': name, 'p': flat(simplify_ring(ring, 0.8))})
            continue
        if t.get('leisure') or t.get('landuse'):
            for ring in polys:
                if len(ring) >= 3:
                    green.append({'n': name, 'k': t.get('leisure') or t.get('landuse'), 'p': flat(simplify_ring(ring, 0.8))})
            continue
        if t.get('amenity'):
            for ring in polys:
                if len(ring) >= 3:
                    areas.append({'n': name, 'k': t['amenity'], 'p': flat(simplify_ring(ring, 0.8))})
    xs = [v for r in roads for v in r['p'][0::2]]
    zs = [v for r in roads for v in r['p'][1::2]]
    return {
        'attribution': 'Map data (c) OpenStreetMap contributors, ODbL 1.0',
        'origin': ORIGIN, 'bbox': BBOX,
        'bounds': [min(xs, default=0), min(zs, default=0), max(xs, default=0), max(zs, default=0)],
        'roadClasses': ROAD_CLASSES,
        'roads': roads, 'buildings': buildings, 'rivers': rivers, 'water': water,
        'green': green, 'areas': areas, 'pois': pois, 'places': places,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--in', dest='inp', help='build from a saved Overpass JSON instead of downloading')
    ap.add_argument('--save', help='also save the raw Overpass response here')
    ap.add_argument('--out', default=os.path.join(os.path.dirname(__file__), '..', 'js', 'games', 'kathmandu', 'data', 'kathmandu-map.json'))
    a = ap.parse_args()
    if a.inp:
        with open(a.inp) as f:
            data = json.load(f)
    else:
        data = download(a.save)
    m = build(data)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, 'w') as f:
        json.dump(m, f, separators=(',', ':'), ensure_ascii=False)
    print(f"{len(m['roads'])} roads, {len(m['buildings'])} buildings, {len(m['rivers'])} rivers, "
          f"{len(m['water'])} ponds, {len(m['green'])} parks, {len(m['pois'])} places of interest "
          f"-> {os.path.relpath(a.out)} ({os.path.getsize(a.out) // 1024} KB)")


if __name__ == '__main__':
    main()
