// Global state
let allOrganizations = [];
let organizationsWithoutLocation = [];
let selectedCounties = new Set();
let currentMap = null;
let activeFilter = null;
let selectedStatus = null; // 'pending' | 'in-progress' | 'done' | null
let searchQuery = ''; // Search text

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    loadOrganizations();
    setupEventListeners();
    
    // Listen for messages from iframe (map popup)
    window.addEventListener('message', function(event) {
        if (event.data.type === 'openOrgModal') {
            const orgId = event.data.orgId;
            if (orgId) {
                viewOrganizationDetails(allOrganizations.find(o => o.id === orgId));
            }
        }
    });
});

// Fetch organizations and counties
async function loadOrganizations() {
    try {
        // Load counties
        const countiesResponse = await fetch('/api/counties');
        const counties = await countiesResponse.json();
        populateCountyFilters(counties);
        
        // Load organizations (split endpoints)
        const [orgsAllResp, orgsNoLocResp] = await Promise.all([
            fetch('/api/organizations'),
            fetch('/api/organizations_without_location')
        ]);
        allOrganizations = await orgsAllResp.json();
        organizationsWithoutLocation = await orgsNoLocResp.json();
        
        // Render map (ensure map shows immediately with all counties)
        selectedCounties = new Set(counties); // all selected by default
        loadMap();
        
        // Render organizations without location
        renderOrganizationsWithoutLocation();
        
        // Update statistics
        updateStatistics();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Select all checkbox
    document.getElementById('select-all').addEventListener('change', function(e) {
        const checkboxes = document.querySelectorAll('#category-filters input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
        
        if (e.target.checked) {
            document.querySelectorAll('.filter-item').forEach(item => {
                selectedCounties.add((item.dataset.county || '').trim());
            });
        } else {
            selectedCounties.clear();
        }
        
        applyFilters();
    });
    
    // Modal close buttons
    document.querySelectorAll('.close').forEach(btn => {
        btn.addEventListener('click', function() {
            document.getElementById('org-modal').style.display = 'none';
            document.getElementById('comment-modal').style.display = 'none';
        });
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', function(e) {
        const orgModal = document.getElementById('org-modal');
        const commentModal = document.getElementById('comment-modal');
        if (e.target === orgModal) {
            orgModal.style.display = 'none';
        }
        if (e.target === commentModal) {
            commentModal.style.display = 'none';
        }
    });
    // Clickable stats to filter by status
    const pendingEl = document.getElementById('pending-count');
    const inprogEl = document.getElementById('in-progress-count');
    const doneEl = document.getElementById('completed-count');
    if (pendingEl) pendingEl.parentElement.style.cursor = 'pointer';
    if (inprogEl) inprogEl.parentElement.style.cursor = 'pointer';
    if (doneEl) doneEl.parentElement.style.cursor = 'pointer';
    if (pendingEl) pendingEl.parentElement.addEventListener('click', () => { selectedStatus = 'pending'; applyFilters(); });
    if (inprogEl) inprogEl.parentElement.addEventListener('click', () => { selectedStatus = 'in-progress'; applyFilters(); });
    if (doneEl) doneEl.parentElement.addEventListener('click', () => { selectedStatus = 'done'; applyFilters(); });
}

// Populate county filters (alphabetical) and default-select all
function populateCountyFilters(counties) {
    const filterContainer = document.getElementById('category-filters');
    filterContainer.innerHTML = '';
    const sorted = [...counties].map(c => (c || '').trim()).filter(c => c.length > 0).sort((a, b) => a.localeCompare(b));
    sorted.forEach(county => {
        const filterItem = document.createElement('div');
        filterItem.className = 'filter-item';
        filterItem.dataset.county = county;
        filterItem.innerHTML = `
            <input type="checkbox" id="county-${county}" value="${county}" checked>
            <label for="county-${county}">${county}</label>
        `;
        
        // Add event listener
        const checkbox = filterItem.querySelector('input');
        checkbox.addEventListener('change', function() {
            if (this.checked) {
                selectedCounties.add((county || '').trim());
            } else {
                selectedCounties.delete((county || '').trim());
            }
            applyFilters();
            updateSelectAllCheckbox();
        });
        
        filterContainer.appendChild(filterItem);
        // Default select all
        selectedCounties.add((county || '').trim());
    });
    // Reflect default select-all UI state
    updateSelectAllCheckbox();
}

// Update select all checkbox state
function updateSelectAllCheckbox() {
    const checkboxes = document.querySelectorAll('#category-filters input[type="checkbox"]');
    const checkedBoxes = document.querySelectorAll('#category-filters input[type="checkbox"]:checked');
    const selectAll = document.getElementById('select-all');
    
    selectAll.checked = checkboxes.length > 0 && checkedBoxes.length === checkboxes.length;
    selectAll.indeterminate = checkedBoxes.length > 0 && checkedBoxes.length < checkboxes.length;
}

// Apply status filter
function applyStatusFilter(status) {
    selectedStatus = status || null;
    applyFilters();
}

// Apply search filter
function applySearch(query) {
    searchQuery = (query || '').trim().toLowerCase();
    applyFilters();
}

// Apply filters to map
function applyFilters() {
    loadMap();
    renderOrganizationsWithoutLocation();
    updateStatistics();
}

// Load map with Folium
async function loadMap() {
    try {
    const params = new URLSearchParams();
    if (selectedCounties.size > 0) params.set('counties', [...selectedCounties].map(c => (c || '').trim()).join(','));
        if (selectedStatus) params.set('status', selectedStatus);
        if (searchQuery) params.set('search', searchQuery);
        const qs = params.toString();
        const response = await fetch(`/api/map${qs ? ('?' + qs) : ''}`);
        const mapHtml = await response.text();
        // Render Folium map via iframe so embedded scripts execute
        const mapContainer = document.getElementById('map');
        // Clear previous content
        mapContainer.innerHTML = '';
        const iframe = document.createElement('iframe');
        iframe.setAttribute('title', 'Community Map');
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = '0';
        iframe.referrerPolicy = 'no-referrer';
        // Use srcdoc to inject Folium HTML and ensure scripts run
        iframe.srcdoc = mapHtml;
        mapContainer.appendChild(iframe);

        // Bridge clicks inside the map iframe(s) to parent app
        const wireDoc = (doc) => {
            if (!doc) return;
            try {
                doc.addEventListener('click', (e) => {
                    const btn = e.target.closest('[data-verify-id]');
                    if (btn) {
                        const idStr = btn.getAttribute('data-verify-id');
                        const orgId = parseInt(idStr, 10);
                        if (Number.isFinite(orgId)) {
                            openOrgFromMap(orgId);
                        }
                        e.preventDefault();
                        e.stopPropagation();
                    }
                }, true);
            } catch (err) {
                console.warn('Unable to wire document events:', err);
            }
        };

        iframe.addEventListener('load', () => {
            try {
                const doc = iframe.contentDocument || iframe.contentWindow.document;
                wireDoc(doc);
                // Folium often nests another iframe inside srcdoc; wire that too
                const innerIframe = doc && doc.querySelector('iframe');
                if (innerIframe) {
                    innerIframe.addEventListener('load', () => {
                        try {
                            const innerDoc = innerIframe.contentDocument || innerIframe.contentWindow.document;
                            wireDoc(innerDoc);
                        } catch (e) {
                            console.warn('Unable to wire inner iframe events:', e);
                        }
                    });
                    // If already loaded
                    try { if (innerIframe.contentDocument) wireDoc(innerIframe.contentDocument); } catch (_) {}
                }
            } catch (err) {
                console.warn('Unable to wire iframe events:', err);
            }
        });

        // Add click event listeners to markers after map loads
        setTimeout(() => {
            setupMapMarkerListeners();
        }, 500);
        
    } catch (error) {
        console.error('Error loading map:', error);
    }
}

// Setup marker click listeners
function setupMapMarkerListeners() {
    // Folium markers will open popups on click automatically
    // We can add additional JavaScript functionality here if needed
}

// Render organizations without location
function renderOrganizationsWithoutLocation() {
    const container = document.getElementById('no-location-list');
    container.innerHTML = '';
    
    // Filter by status if selected
    let list = organizationsWithoutLocation;
    if (selectedStatus) {
        list = list.filter(o => normalizeStatus(o.status) === selectedStatus);
    }
    
    // Apply search filter
    if (searchQuery) {
        list = list.filter(org => {
            const name = (org.ORGANIZATION || '').toLowerCase();
            const address = (org.ADDRESS || '').toLowerCase();
            const county = (org.county || '').toLowerCase();
            const phone = (org.PHONE || '').toLowerCase();
            const email = (org.EMAIL || '').toLowerCase();
            return name.includes(searchQuery) || 
                   address.includes(searchQuery) || 
                   county.includes(searchQuery) ||
                   phone.includes(searchQuery) ||
                   email.includes(searchQuery);
        });
    }
    
    // Sort: Pending first, then others
    list = [...list].sort((a, b) => {
        const aPending = normalizeStatus(a.status) === 'pending';
        const bPending = normalizeStatus(b.status) === 'pending';
        if (aPending && !bPending) return -1;
        if (!aPending && bPending) return 1;
        return 0;
    });

    if (list.length === 0) {
        container.innerHTML = '<p style="color: #888; font-style: italic;">No organizations without location</p>';
        return;
    }
    
    list.forEach(org => {
        const card = createOrganizationCard(org);
        container.appendChild(card);
    });
}

// Create organization card
function createOrganizationCard(org) {
    const card = document.createElement('div');
    card.className = 'org-card';
    const statusDisplay = org.status || 'Pending';
    const statusClass = (statusDisplay).replace(/[^a-zA-Z]/g, '').toLowerCase() || 'pending';
    const historyList = Array.isArray(org.note_history) ? org.note_history : [];
    const historyHtml = historyList.length > 0
        ? `
            <div class="org-notes">
                <div class="org-notes-title">Notes</div>
                <ul class="org-notes-list">
                    ${historyList.map(h => `
                        <li>
                            <strong>${(h.note_taker||'').toString()}</strong> — ${(h.note||'').toString()} — 
                            <span class="org-notes-date">${(h.date||'').toString()}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
          `
        : '';
    card.innerHTML = `
        <div class="org-card-header">
            <div>
                <div class="org-name">${org.ORGANIZATION || 'Organization'}</div>
                <span class="org-category">${org.county || 'N/A'}</span>
            </div>
            <span class="status-badge status-${statusClass}">${statusDisplay}</span>
        </div>
        <div class="org-description">${org.ADDRESS || 'No address provided'}</div>
        ${historyHtml}
        <div class="org-actions org-actions-layout">
            <div class="org-actions-row">
                <select id="status-select-${org.id}" class="status-select">
                    <option value="Pending" ${statusDisplay === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="Confirmed--Yes" ${statusDisplay === 'Confirmed--Yes' ? 'selected' : ''}>Confirmed--Yes</option>
                    <option value="Confirmed--No" ${statusDisplay === 'Confirmed--No' ? 'selected' : ''}>Confirmed--No</option>
                    <option value="In Process" ${statusDisplay === 'In Process' ? 'selected' : ''}>In Process</option>
                    <option value="Other" ${statusDisplay === 'Other' ? 'selected' : ''}>Other</option>
                </select>
                <button class="btn btn-success btn-small" onclick="confirmStatusChange(${org.id})">
                    <i class="fas fa-check"></i> Confirm
                </button>
            </div>
            <div class="org-actions-row">
                <button class="btn btn-primary btn-small" onclick="openCommentModal(${org.id})">
                    <i class="fas fa-comment"></i> Add Note
                </button>
            </div>
        </div>
    `;
    
    // Add click handler to view details
    card.addEventListener('click', function(e) {
        // Don't open modal if clicking on buttons, selects, or any interactive element
        if (e.target.tagName !== 'BUTTON' && 
            e.target.tagName !== 'SELECT' && 
            e.target.tagName !== 'I' &&
            !e.target.closest('button') && 
            !e.target.closest('select') &&
            !e.target.closest('.org-actions')) {
            viewOrganizationDetails(org);
        }
    });
    
    return card;
}

// View organization details
function viewOrganizationDetails(org) {
    const modal = document.getElementById('org-modal');
    const modalBody = document.getElementById('modal-body');
    const statusDisplay = org.status || 'Pending';
    const statusClass = (statusDisplay).replace(/[^a-zA-Z]/g, '').toLowerCase() || 'pending';
    
    modalBody.innerHTML = `
        <h2 style="color: #667eea; margin-bottom: 20px;">${org.ORGANIZATION || 'Organization'}</h2>
        <div class="org-detail">
            <label>County:</label>
            <div class="org-detail-value">${org.county || 'N/A'}</div>
        </div>
        <div class="org-detail">
            <label>Address:</label>
            <div class="org-detail-value">${org.ADDRESS || 'Not provided'}</div>
        </div>
        <div class="org-detail">
            <label>Zipcode:</label>
            <div class="org-detail-value">${org.zipcode || 'N/A'}</div>
        </div>
        <div class="org-detail">
            <label>Website:</label>
            <div class="org-detail-value">
                ${org.WEBSITE && org.WEBSITE !== 'N/A' && org.WEBSITE !== 'nan' && org.WEBSITE.trim() !== '' 
                    ? `<a href="${org.WEBSITE.startsWith('http') ? org.WEBSITE : 'https://' + org.WEBSITE}" target="_blank" style="color:#667eea;">${org.WEBSITE}</a>`
                    : 'N/A'}
            </div>
        </div>
        <div class="org-detail">
            <label>Phone:</label>
            <div class="org-detail-value">${org.PHONE || 'N/A'}</div>
        </div>
        <div class="org-detail">
            <label>Email:</label>
            <div class="org-detail-value">${org.EMAIL || 'N/A'}</div>
        </div>
        <div class="org-detail">
            <label>Status:</label>
            <div class="org-detail-value">
                <select id="modal-status-select-${org.id}" style="padding: 5px 10px; border-radius: 4px; width: 100%;">
                    <option value="Pending" ${statusDisplay === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="Confirmed--Yes" ${statusDisplay === 'Confirmed--Yes' ? 'selected' : ''}>Confirmed--Yes</option>
                    <option value="Confirmed--No" ${statusDisplay === 'Confirmed--No' ? 'selected' : ''}>Confirmed--No</option>
                    <option value="In Process" ${statusDisplay === 'In Process' ? 'selected' : ''}>In Process</option>
                    <option value="Other" ${statusDisplay === 'Other' ? 'selected' : ''}>Other</option>
                </select>
            </div>
        </div>
        ${(Array.isArray(org.note_history) && org.note_history.length > 0) ? `
        <div class="org-detail">
            <label>Notes:</label>
            <div class="org-detail-value">
                <ul style="margin:0; padding-left:18px;">
                    ${org.note_history.map(h => `<li><strong>${(h.note_taker||'').toString()}</strong> — ${(h.note||'').toString()} — <span style=\"color:#666;\">${(h.date||'').toString()}</span></li>`).join('')}
                </ul>
            </div>
        </div>
        ` : ''}
        <div class="modal-buttons" style="margin-top: 30px;">
            <button class="btn btn-secondary" onclick="document.getElementById('org-modal').style.display='none'">Close</button>
            <button class="btn btn-success" onclick="confirmStatusChangeFromModal(${org.id})">
                <i class="fas fa-check"></i> Confirm Status
            </button>
            <button class="btn btn-primary" onclick="openCommentModal(${org.id})">
                <i class="fas fa-comment"></i> Add Note
            </button>
        </div>
    `;
    
    modal.style.display = 'block';
}

// Mark organization as done
async function markAsDone(orgId) {
    try {
        const response = await fetch(`/api/organizations/${orgId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'done' })
        });
        
        if (response.ok) {
            const data = await response.json();
            const updated = data && data.organization ? data.organization : null;
            // Update local state
            const org = allOrganizations.find(o => o.id === orgId);
            if (org && updated) {
                Object.assign(org, updated);
            } else if (org) {
                org.status = 'done';
            }
            
            // Refresh displays
            renderOrganizationsWithoutLocation();
            updateStatistics();
            loadMap();
            
            // Close modals
            document.getElementById('org-modal').style.display = 'none';
            document.getElementById('comment-modal').style.display = 'none';
            
            alert('Organization marked as done!');
        }
    } catch (error) {
        console.error('Error marking as done:', error);
        alert('Error updating status');
    }
}

// Change organization status
async function changeStatus(orgId, newStatus) {
    try {
        const response = await fetch(`/api/organizations/${orgId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        if (response.ok) {
            const data = await response.json();
            const updated = data && data.organization ? data.organization : null;
            // Update local state
            const org = allOrganizations.find(o => o.id === orgId);
            if (org && updated) {
                Object.assign(org, updated);
            } else if (org) {
                org.status = newStatus;
            }
            
            // Refresh displays
            renderOrganizationsWithoutLocation();
            updateStatistics();
            loadMap();
        }
    } catch (error) {
        console.error('Error changing status:', error);
        alert('Error updating status');
    }
}

// Change organization status from modal
async function changeStatusFromModal(orgId, newStatus) {
    await changeStatus(orgId, newStatus);
    document.getElementById('org-modal').style.display = 'none';
}

// Confirm status change (from org card)
async function confirmStatusChange(orgId) {
    const select = document.getElementById(`status-select-${orgId}`);
    if (!select) return;
    const newStatus = select.value;
    await changeStatus(orgId, newStatus);
}

// Confirm status change from modal
async function confirmStatusChangeFromModal(orgId) {
    const select = document.getElementById(`modal-status-select-${orgId}`);
    if (!select) return;
    const newStatus = select.value;
    await changeStatus(orgId, newStatus);
    document.getElementById('org-modal').style.display = 'none';
}

// Open organization details from map popup (make it global)
window.openOrgFromMap = function(orgId) {
    const org = allOrganizations.find(o => o.id === orgId);
    if (!org) {
        console.error('Organization not found:', orgId);
        return;
    }
    viewOrganizationDetails(org);
};

// Open comment modal
function openCommentModal(orgId) {
    const org = allOrganizations.find(o => o.id === orgId);
    if (!org) return;
    
    const modal = document.getElementById('comment-modal');
    const orgInfo = document.getElementById('comment-org-info');
    const commentText = document.getElementById('comment-text');
    
    const statusDisplay = org.status || 'Pending';
    orgInfo.innerHTML = `
        <h3 style="margin-bottom:8px;">${org.ORGANIZATION || 'Organization'}</h3>
        <p style="margin: 0;"><strong>Current Status:</strong> <span class="status-badge status-${(statusDisplay).replace(/[^a-zA-Z]/g, '').toLowerCase()}">${statusDisplay}</span></p>
        <div style="margin-top:10px;">
            <label for="note-taker-select" style="display:block; font-weight:600; margin-bottom:6px;">Note Taker</label>
            <select id="note-taker-select" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;">
                <option value="">Select a name</option>
                <option value="Luke">Luke</option>
                <option value="Rebecca">Rebecca</option>
                <option value="Tauheeda">Tauheeda</option>
                <option value="Jiaqin">Jiaqin</option>
                <option value="Jennifer">Jennifer</option>
                <option value="Kimberly">Kimberly</option>
                <option value="Rachel">Rachel</option>
                <option value="Sayed">Sayed</option>
            </select>
        </div>
    `;
    
    commentText.value = org.notes || '';
    
    modal.dataset.orgId = orgId;
    modal.style.display = 'block';
}

// Save comment
async function saveComment() {
    const modal = document.getElementById('comment-modal');
    const orgId = parseInt(modal.dataset.orgId);
    const commentText = document.getElementById('comment-text').value;
    const noteTaker = document.getElementById('note-taker-select') ? document.getElementById('note-taker-select').value : '';
    
    try {
        const response = await fetch(`/api/organizations/${orgId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                notes: commentText,
                note_taker: noteTaker
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            const updated = data && data.organization ? data.organization : null;
            const org = allOrganizations.find(o => o.id === orgId);
            if (org && updated) {
                Object.assign(org, updated);
            } else if (org) {
                // Do not change status on note save; only update notes locally as fallback
                org.notes = commentText;
                org.note_taker = noteTaker;
                if (!Array.isArray(org.note_history)) org.note_history = [];
                org.note_history.push({ note_taker: noteTaker, note: commentText, date: new Date().toISOString().slice(0,16).replace('T',' ') });
            }
            
            renderOrganizationsWithoutLocation();
            updateStatistics();
            loadMap();
            modal.style.display = 'none';
            
            alert('Note saved successfully!');
        }
    } catch (error) {
        console.error('Error saving comment:', error);
        alert('Error saving note');
    }
}

// Close comment modal
function closeCommentModal() {
    document.getElementById('comment-modal').style.display = 'none';
}

// Update statistics
function updateStatistics() {
    // Total = filtered with-location + all without-location (never filtered)
    const filteredWithLoc = selectedCounties.size > 0
        ? allOrganizations.filter(o => o.county && selectedCounties.has(o.county) && isValidCoord(o.lat) && isValidCoord(o.lon))
        : allOrganizations.filter(o => isValidCoord(o.lat) && isValidCoord(o.lon));
    const withoutLocCount = organizationsWithoutLocation.length;
    const totalCount = selectedCounties.size > 0 ? filteredWithLoc.length + withoutLocCount : allOrganizations.length;
    
    document.getElementById('total-orgs').textContent = totalCount;
    document.getElementById('with-location').textContent = filteredWithLoc.length;
    const withoutEl = document.getElementById('without-location');
    if (withoutEl) withoutEl.textContent = withoutLocCount;

    // Status counts from all organizations
    const statusFilt = selectedStatus ? allOrganizations.filter(o => normalizeStatus(o.status) === selectedStatus) : allOrganizations;
    
    const pending = o => (o.status || '').toString().trim().toLowerCase() === 'pending';
    const confirmedYes = o => (o.status || '').toString().trim().toLowerCase() === 'confirmed--yes';
    const confirmedNo = o => (o.status || '').toString().trim().toLowerCase() === 'confirmed--no';
    const inProcess = o => {
        const s = (o.status || '').toString().trim().toLowerCase();
        return s === 'in process' || s === 'in-process';
    };
    const other = o => {
        const s = (o.status || '').toString().trim().toLowerCase();
        return s === 'other';
    };
    
    document.getElementById('pending-count').textContent = statusFilt.filter(pending).length;
    document.getElementById('confirmed-yes-count').textContent = statusFilt.filter(confirmedYes).length;
    document.getElementById('confirmed-no-count').textContent = statusFilt.filter(confirmedNo).length;
    document.getElementById('in-process-count').textContent = statusFilt.filter(inProcess).length;
    document.getElementById('other-count').textContent = statusFilt.filter(other).length;
}

function normalizeStatus(s) {
    const v = (s || '').toString().trim().toLowerCase();
    if (v === 'pending' || v === 'todo' || v === 'to-do' || v === 'new') return 'pending';
    if (v === 'in-progress' || v === 'in progress' || v === 'in_progress' || v === 'progress' || v === 'working') return 'in-progress';
    if (v === 'done' || v === 'completed' || v === 'complete' || v === 'verified') return 'done';
    return v;
}

// Helpers
function isValidCoord(v) {
    const n = Number(v);
    return Number.isFinite(n);
}

function isNaLike(v) {
    if (v === undefined || v === null) return true;
    const s = String(v).trim().toLowerCase();
    if (s === '' || s === 'nan' || s === 'none' || s === 'null') return true;
    const n = Number(v);
    return Number.isNaN(n);
}

