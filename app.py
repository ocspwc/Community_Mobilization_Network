from flask import Flask, render_template, jsonify, request, Response
from folium import Map, Marker, Popup, Icon
from folium.plugins import MarkerCluster
import json
import pandas as pd
from datetime import datetime
import os
import requests

app = Flask(__name__)

df = pd.read_csv('Final_df.csv')

# Simple persistent overlay store for status and notes
STATE_FILE = os.environ.get('STATE_FILE_PATH', 'state.json')

# Supabase REST API configuration (optional)
SUPABASE_URL = os.environ.get('SUPABASE_URL', '').rstrip('/')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')
SUPABASE_TABLE = os.environ.get('SUPABASE_TABLE', 'organization_overlays')
USE_SUPABASE = bool(SUPABASE_URL and SUPABASE_KEY)

def load_state():
    """Load state from Supabase REST API or local file."""
    # Try Supabase first if configured
    if USE_SUPABASE:
        try:
            # Fetch the state record (we store it as a single JSON object)
            url = f"{SUPABASE_URL}/rest/v1/{SUPABASE_TABLE}?id=eq.1"
            headers = {
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}',
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
            resp = requests.get(url, headers=headers, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                if data and len(data) > 0:
                    state_json = data[0].get('state_data')
                    if state_json:
                        return json.loads(state_json) if isinstance(state_json, str) else state_json
        except Exception as e:
            print(f"Supabase load error: {e}")
            # Fall through to local file
    
    # Fallback to local file
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, 'r') as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_state(state):
    """Save state to Supabase REST API or local file."""
    state_json_str = json.dumps(state, ensure_ascii=False, indent=2)
    
    # Try Supabase first if configured
    if USE_SUPABASE:
        try:
            url = f"{SUPABASE_URL}/rest/v1/{SUPABASE_TABLE}"
            headers = {
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}',
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
            # Use PATCH for update (record with id=1 should always exist after SQL setup)
            patch_url = f"{url}?id=eq.1"
            payload = {
                'state_data': state_json_str,
                'updated_at': datetime.utcnow().isoformat() + 'Z'
            }
            resp = requests.patch(patch_url, headers=headers, json=payload, timeout=10)
            if 200 <= resp.status_code < 300:
                print(f"Successfully saved to Supabase (status {resp.status_code})")
                return
            else:
                print(f"Supabase PATCH failed with status {resp.status_code}: {resp.text}")
        except Exception as e:
            print(f"Supabase save error: {e}")
            # Fall through to local file
    
    # Fallback to local file
    try:
        # Ensure parent directory exists if a path was provided
        state_dir = os.path.dirname(STATE_FILE)
        if state_dir:
            os.makedirs(state_dir, exist_ok=True)
        with open(STATE_FILE, 'w') as f:
            f.write(state_json_str)
        print(f"Saved to local file: {STATE_FILE}")
    except Exception as e:
        print(f"Local save error: {e}")

# Convert to list of dictionaries
organizations = df.to_dict(orient='records')
state_overlay = load_state()

# Add ID if not present
for idx, org in enumerate(organizations, start=1):
    # Clean NaN/None-like values across all fields to ensure valid JSON
    for k, v in list(org.items()):
        try:
            if isinstance(v, float) and pd.isna(v):
                org[k] = None
            elif isinstance(v, str) and v.strip().lower() in ('nan', 'none', 'null', ''):
                org[k] = None
        except Exception:
            pass
    if 'id' not in org or not org['id']:
        org['id'] = idx
    # Normalize county field
    if 'county' not in org or org.get('county') in (None, ''):
        if 'COUNTY' in org and org['COUNTY'] not in (None, ''):
            org['county'] = org['COUNTY']
    # Normalize zipcode (best-effort)
    if 'zipcode' not in org or org.get('zipcode') in (None, ''):
        for z_key in ['ZIPCODE', 'Zipcode', 'ZIP', 'Zip']:
            if z_key in org and org[z_key] not in (None, ''):
                org['zipcode'] = org[z_key]
                break
    # Coerce lat/lon from possible column names and to float
    lat_val = org.get('lat') or org.get('latitude') or org.get('LAT') or org.get('Lat') or org.get('Latitude')
    lon_val = org.get('lon') or org.get('longitude') or org.get('LON') or org.get('Lon') or org.get('lng') or org.get('LNG') or org.get('Longitude')
    try:
        org['lat'] = float(lat_val) if lat_val not in (None, '') else None
    except Exception:
        org['lat'] = None
    try:
        org['lon'] = float(lon_val) if lon_val not in (None, '') else None
    except Exception:
        org['lon'] = None
    # Ensure fields used by UI exist with proper status defaults
    if 'status' not in org or not org.get('status'):
        org['status'] = 'Pending'
    # Normalize status field to match expected values
    status_val = org.get('status', 'Pending')
    org['status'] = status_val
    if 'notes' not in org:
        org['notes'] = ''
    if 'note_taker' not in org:
        org['note_taker'] = ''
    if 'note_history' not in org or not isinstance(org.get('note_history'), list):
        org['note_history'] = []

    # Apply persisted overlay if present
    sid = str(org['id'])
    if sid in state_overlay:
        overlay = state_overlay[sid]
        if 'status' in overlay:
            org['status'] = overlay['status']
        if 'notes' in overlay:
            org['notes'] = overlay['notes']
        if 'note_taker' in overlay:
            org['note_taker'] = overlay['note_taker']
        if 'note_history' in overlay and isinstance(overlay['note_history'], list):
            org['note_history'] = overlay['note_history']


def has_valid_coords(org: dict) -> bool:
    """True if org has valid numeric lat/lon within bounds and not NaN."""
    lat = org.get('lat')
    lon = org.get('lon')
    if isinstance(lat, (int, float)) and isinstance(lon, (int, float)):
        if not pd.isna(lat) and not pd.isna(lon):
            try:
                return -90 <= float(lat) <= 90 and -180 <= float(lon) <= 180
            except Exception:
                return False
    return False


def is_missing_lat(org: dict) -> bool:
    """Check if org is missing latitude (NaN, empty string, 'nan', etc.)"""
    lat = org.get('lat')
    if lat is None:
        return True
    s = str(lat).strip().lower()
    if s == '' or s == 'nan' or s == 'none' or s == 'null':
        return True
    try:
        lat_val = float(lat)
        return pd.isna(lat_val)
    except Exception:
        return True


# Split into with/without location datasets
organizations_without_location = [org for org in organizations if not has_valid_coords(org)]
organizations_with_location = [org for org in organizations if has_valid_coords(org)]

@app.route('/')
def index():
    """Render the main page"""
    return render_template('index.html')


@app.route('/api/organizations')
def get_organizations():
    """Get all organizations"""
    return jsonify(organizations)


@app.route('/api/organizations_with_location')
def get_orgs_with_location():
    """Get organizations that have valid coordinates"""
    return jsonify(organizations_with_location)


@app.route('/api/organizations_without_location')
def get_orgs_without_location():
    """Get organizations that are missing coordinates"""
    return jsonify(organizations_without_location)


@app.route('/api/organizations/<int:org_id>/status', methods=['PUT'])
def update_status(org_id):
    """Update organization status"""
    data = request.json
    for org in organizations:
        if org['id'] == org_id:
            # Update status
            org['status'] = data.get('status', org['status'])
            # Update notes and note taker
            note_text = data.get('notes')
            note_taker = data.get('note_taker')
            if note_text is not None:
                org['notes'] = note_text
            if note_taker is not None:
                org['note_taker'] = note_taker
            # Append history entry when a note is provided
            if note_text:
                if 'note_history' not in org or not isinstance(org.get('note_history'), list):
                    org['note_history'] = []
                timestamp = datetime.now().strftime('%Y-%m-%d %H:%M')
                org['note_history'].append({
                    'note_taker': note_taker or '',
                    'note': note_text,
                    'date': timestamp,
                })
            # Persist overlay
            sid = str(org['id'])
            current = state_overlay.get(sid, {})
            current.update({
                'status': org['status'],
                'notes': org.get('notes', ''),
                'note_taker': org.get('note_taker', ''),
                'note_history': org.get('note_history', []),
            })
            state_overlay[sid] = current
            save_state(state_overlay)
            return jsonify({'success': True, 'organization': org})
    return jsonify({'success': False}), 404


# ---------- Read-only admin/export endpoints ----------
@app.route('/api/state')
def get_state_overlay():
    """Return the persisted overlay (statuses, notes, note_history)."""
    try:
        return jsonify(state_overlay)
    except Exception:
        return jsonify({})


@app.route('/api/organizations_full')
def get_organizations_full():
    """Return the full in-memory organizations, including note_history."""
    return jsonify(organizations)


@app.route('/api/export.csv')
def export_csv():
    """Download a CSV snapshot of organizations with status and note history as JSON string."""
    try:
        # Make a shallow copy and stringify note_history
        export_rows = []
        for org in organizations:
            row = dict(org)
            # Ensure note_history is serializable as a single column
            if isinstance(row.get('note_history'), list):
                try:
                    row['note_history'] = json.dumps(row['note_history'], ensure_ascii=False)
                except Exception:
                    row['note_history'] = ''
            export_rows.append(row)

        df_export = pd.DataFrame(export_rows)
        csv_data = df_export.to_csv(index=False)
        return Response(
            csv_data,
            mimetype='text/csv',
            headers={
                'Content-Disposition': 'attachment; filename=organizations_export.csv'
            }
        )
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/map')
def get_map():
    """Generate and return a Folium map"""
    # Optional county filter from query params
    counties_param = request.args.get('counties')
    selected_counties = None
    if counties_param:
        selected_counties = set([c.strip() for c in counties_param.split(',') if c.strip()])
    # Optional status filter
    status_param = request.args.get('status')
    # Optional search query
    search_query = request.args.get('search', '').strip().lower()
    def normalize_status(s):
        if s is None:
            return 'pending'
        v = str(s).strip().lower()
        if v in ('pending', 'todo', 'to-do', 'new'):
            return 'pending'
        if v in ('in-progress', 'in progress', 'in_progress', 'progress', 'working'):
            return 'in-progress'
        if v in ('done', 'completed', 'complete', 'verified'):
            return 'done'
        return v
    normalized_status = normalize_status(status_param) if status_param else None

    # Start from with-location subset
    orgs_with_location = list(organizations_with_location)

    # Apply county filter if provided
    if selected_counties is not None and len(selected_counties) > 0:
        orgs_with_location = [org for org in orgs_with_location if org.get('county') in selected_counties]
    # Apply status filter if provided
    if normalized_status is not None:
        orgs_with_location = [org for org in orgs_with_location if normalize_status(org.get('status')) == normalized_status]
    # Apply search filter if provided
    if search_query:
        def matches_search(org):
            name = (org.get('ORGANIZATION') or '').lower()
            address = (org.get('ADDRESS') or '').lower()
            county = (org.get('county') or '').lower()
            phone = (org.get('PHONE') or '').lower()
            email = (org.get('EMAIL') or '').lower()
            return (search_query in name or search_query in address or 
                    search_query in county or search_query in phone or search_query in email)
        orgs_with_location = [org for org in orgs_with_location if matches_search(org)]
    
    if not orgs_with_location:
        # Create a default map centered on NYC
        folium_map = Map(location=[38.2, -77.2], zoom_start=9)
        return folium_map._repr_html_()
    
    # Group organizations by zipcode (optional usage for future)
    zipcode_groups = {}
    for org in orgs_with_location:
        zipcode = org.get('zipcode')
        if zipcode not in zipcode_groups:
            zipcode_groups[zipcode] = []
        zipcode_groups[zipcode].append(org)
    
    
    # Create the map
    folium_map = Map(location=[38.6, -77.2], zoom_start=9)
    
    # Create a marker cluster
    marker_cluster = MarkerCluster().add_to(folium_map)
    
    # Define colors for different statuses
    status_colors = {
        'pending': 'yellow',  # Yellow for pending
        'Pending': 'yellow',
        'confirmed--yes': 'green',  # Green for confirmed yes
        'Confirmed--Yes': 'green',
        'confirmed--no': 'red',  # Red for confirmed no
        'Confirmed--No': 'red',
        'in process': 'blue',  # Blue for in process
        'In Process': 'blue',
        'other': 'gray',  # Gray for other
        'Other': 'gray',
    }
    
    # Add markers for each organization
    for org in orgs_with_location:
        # Get status and determine color
        status_val = org.get('status', 'Pending')
        color = status_colors.get(status_val.lower(), 'gray')

        # Safe fallbacks
        name = org.get('ORGANIZATION') or 'Organization'
        address_val = org.get('ADDRESS')
        has_address = address_val not in (None, '')
        address = address_val if has_address else 'No address provided'
        phone = org.get('PHONE') or 'N/A'
        email = org.get('EMAIL') or 'N/A'
        # Create website link
        website_raw = org.get('WEBSITE') or ''
        website_html = 'N/A'
        if website_raw and str(website_raw).strip() and str(website_raw).strip().lower() not in ('none', 'nan', 'null', 'n/a'):
            website_clean = str(website_raw).strip()
            # Add protocol if missing
            if website_clean and not website_clean.startswith(('http://', 'https://')):
                website_href = 'https://' + website_clean
            else:
                website_href = website_clean
            website_html = f'<a href="{website_href}" target="_blank" style="color:#667eea; text-decoration:underline;">{website_clean}</a>'
        
        county = org.get('county') or 'N/A'
        zipcode = int(org.get('zipcode')) if org.get('zipcode') not in (None, '') else 'N/A'
        status_text = status_val
        # Build notes history HTML
        notes_html = ''
        history = org.get('note_history') or []
        if history:
            items = []
            for entry in history:
                who = (entry.get('note_taker') or '').strip()
                text = (entry.get('note') or '').strip()
                date = (entry.get('date') or '').strip()
                items.append(f"<li style=\"margin:2px 0;\"><strong>{who}</strong> — {text} — <span style=\"color:#666;\">{date}</span></li>")
            notes_html = '<div style="margin:6px 0;"><strong>Notes:</strong><ul style="padding-left:16px; margin:6px 0;">' + ''.join(items) + '</ul></div>'

        # Extra emphasis when no address is available
        no_address_hint = '' if has_address else f'<p style="margin:5px 0; color:#555;"><em>No address on file. Phone: {phone}, Email: {email}</em></p>'

        # Create popup content with verification button
        popup_html = f"""
        <div style=\"width:250px; font-family:'Times New Roman', Times, serif;\">
            <h3 style=\"margin:0; color:#333;\">{name}</h3>
            <p style=\"margin:5px 0;\"><strong>Address:</strong> {address}</p>
            {no_address_hint}
            <p style=\"margin:5px 0;\"><strong>Phone:</strong> {phone}</p>
            <p style=\"margin:5px 0;\"><strong>Email:</strong> {email}</p>
            <p style=\"margin:5px 0;\"><strong>Website:</strong> {website_html}</p>
            <p style=\"margin:5px 0;\"><strong>Status:</strong> <span style=\"color:orange\">{status_text}</span></p>
            <p style=\"margin:5px 0;\"><strong>County:</strong> {county}</p>
            <p style=\"margin:5px 0;\"><strong>Zipcode:</strong> {zipcode}</p>
            {notes_html}
            <button data-verify-id="{org.get('id')}" style="display:block; margin-top:10px; padding:8px 12px; background:#667eea; color:white; text-align:center; border:none; border-radius:4px; cursor:pointer; font-weight:600; width:100%;">
                Verify / Change Status
            </button>
        </div>
        """

        Marker(
            location=[float(org['lat']), float(org['lon'])],
            popup=Popup(popup_html, max_width=300),
            icon=Icon(color=color),
            tooltip=name
        ).add_to(marker_cluster)
    
    return folium_map._repr_html_()


@app.route('/api/counties')
def get_counties():
    """Get all unique counties"""
    def _clean(v):
        if v is None:
            return None
        if isinstance(v, float) and pd.isna(v):
            return None
        s = str(v).strip()
        if s.lower() in ('', 'nan', 'none', 'null'):
            return None
        return s

    counties_set = set()
    for org in organizations:
        val = org.get('county') or org.get('COUNTY')
        cleaned = _clean(val)
        if cleaned:
            counties_set.add(cleaned)
    counties = sorted(counties_set, key=lambda x: x.lower())
    return jsonify(counties)


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5002)

