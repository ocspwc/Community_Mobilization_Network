# Community Mobilization Network

A web-based tool for managing and verifying community organizations with interactive geographic visualization.

## Features

1. **Geographic Visualization**
   - Interactive map using Folium showing all organizations with locations
   - Organizations grouped by zipcode using marker clustering
   - Click markers to view detailed information
   - Color-coded markers by category

2. **Category Filters**
   - Filter organizations by category
   - "Select All" option to quickly toggle all categories
   - Real-time filtering of map markers

3. **Organizations Without Locations**
   - Side menu displaying organizations that need address information
   - Easy access to verify and update missing location data

4. **Verification Management**
   - Mark organizations as "Done" when verified
   - Add notes/comments for tracking verification progress
   - Status tracking: Pending, In Progress, Done

5. **Statistics Dashboard**
   - Real-time statistics showing:
     - Total organizations
     - Organizations with location data
     - Status breakdown

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

## Running the Application Locally

1. Start the Flask server:
```bash
python app.py
```

2. Open your browser and navigate to:
```
http://localhost:5000
```

## Deploy to Public Website (FREE!)

Your app is ready to deploy! See **[DEPLOYMENT.md](DEPLOYMENT.md)** for detailed instructions.

### Quick Deploy Options:

**🚀 Recommended: Render.com**
- Free tier: Always free (750 hours/month)
- Easy deployment
- No credit card needed
- Auto-deploys from GitHub

**Other Free Options:**
- Railway.app - $5 free credit/month
- PythonAnywhere - Always free
- Fly.io - Free tier available

See [DEPLOYMENT.md](DEPLOYMENT.md) for step-by-step guides for all platforms.

## Usage

### Viewing Organizations on the Map
- Organizations with valid coordinates appear as markers on the map
- Markers are color-coded by category (Healthcare, Education, Food Assistance, etc.)
- Click on any marker to view detailed information in a modal

### Filtering by Category
- Use the left sidebar to select categories you want to view
- Click "Select All" to quickly toggle all categories
- The map updates automatically based on your selections

### Managing Organizations Without Locations
- Organizations without coordinates appear in the right sidebar
- Click "Done" to mark an organization as verified
- Click "Add Note" to add comments about the organization
- Click the card to view full details

### Adding Notes and Comments
1. Click "Add Note" on any organization
2. Enter your verification notes in the text area
3. Status automatically changes to "In Progress"
4. Click "Save Note" to update

### Marking Organizations as Done
1. Click "Done" button on any organization
2. Status changes to "Done"
3. The organization is marked as verified

## Data Structure

Organizations are stored with the following fields:
- `id`: Unique identifier
- `name`: Organization name
- `category`: Type of organization
- `address`: Street address
- `city`, `state`, `zipcode`: Location details
- `lat`, `lon`: Coordinates (if available)
- `description`: Detailed description
- `status`: Verification status (pending, in-progress, done)
- `notes`: Verification notes

## Customization

### Adding New Organizations
Edit the `organizations` list in `app.py` to add new organizations.

### Modifying Categories
Categories are automatically detected from the organizations data. To add a new category, simply add organizations with that category.

### Adjusting Map Center
The map automatically centers based on organization locations. To change the default, modify the center coordinates in the `/api/map` route.

## API Endpoints

- `GET /`: Main page
- `GET /api/organizations`: Get all organizations
- `GET /api/map`: Get generated Folium map HTML
- `GET /api/categories`: Get all unique categories
- `PUT /api/organizations/<id>/status`: Update organization status and notes

## Technologies Used

- **Flask**: Web framework
- **Folium**: Interactive map generation
- **Leaflet.js**: Map rendering (via Folium)
- **JavaScript**: Frontend interactivity
- **CSS3**: Modern styling and responsive design

## Future Enhancements

- Database integration for persistent storage
- Export functionality for reports
- Search functionality
- Batch operations
- User authentication
- Real-time updates via WebSockets

