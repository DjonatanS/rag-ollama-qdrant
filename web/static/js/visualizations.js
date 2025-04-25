// Note: Ensure this script is loaded AFTER main.js or wrap its contents
// in a function called by main.js after authentication.

// DEBUG: Log when visualizations.js loads with timestamp for debugging
console.log("visualizations.js loaded at: " + new Date().toISOString());

// Global state for visualizations - Expose to window for global access
window.visualizationState = {
    activeFilters: [], // Stores IDs of collections to filter by
    zoomLevel: 1,
    panOffset: { x: 0, y: 0 },
    currentData: [], // Holds the data for the current visualization
    currentVisualizationType: 'scatter', // 'scatter', 'bar', 'table'
    searchHistory: [], // Stores recent similarity searches
    chartInstance: null, // Holds the Chart.js instance
    d3Zoom: null, // Holds the D3 zoom behavior instance
};

// --- Helper Functions ---

// Função de escape HTML (para garantir que esteja disponível para as visualizações)
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Verificar se as bibliotecas estão carregadas
function checkDependencies() {
    const missing = [];
    
    if (typeof d3 === 'undefined') {
        console.error("D3.js não está carregado!");
        missing.push('D3.js');
    } else {
        console.log("D3.js está carregado corretamente:", d3.version);
    }
    
    if (typeof Chart === 'undefined') {
        console.error("Chart.js não está carregado!");
        missing.push('Chart.js');
    } else {
        console.log("Chart.js está carregado corretamente:", Chart.version);
    }
    
    if (missing.length > 0) {
        showBanner(`Dependências ausentes: ${missing.join(', ')}. Os gráficos podem não funcionar.`, 'error');
        return false;
    }
    
    return true;
}

// Check if Dark Mode is active
function isDarkMode() {
    return document.body.classList.contains('dark-mode');
}

// Get Theme-based Colors
function getThemeColors() {
    const darkMode = isDarkMode();
    return {
        textColor: darkMode ? '#e0e0e0' : '#444444',
        secondaryTextColor: darkMode ? '#cccccc' : '#666666',
        gridColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        axisColor: darkMode ? '#aaaaaa' : '#888888',
        tooltipBg: darkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.9)',
        tooltipColor: darkMode ? '#ffffff' : '#333333',
        cardBg: darkMode ? '#444444' : '#ffffff',
        primaryBg: darkMode ? '#222222' : '#f4f7f9',
        highlight: darkMode ? '#008080' : '#008080', // Teal
        highlightAlt: darkMode ? '#FFA500' : '#FFA500', // Orange
        // D3 color scale - can be adjusted based on theme
        d3ColorScale: d3.scaleOrdinal(darkMode
             ? ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'] // Default D3
             : ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'] // Keep same for now, or define light theme scale
         ),
    };
}


// Show Loading state for a specific container
function showLoading(containerId, isLoading) {
    const container = document.getElementById(containerId);
    if (!container) return;
    let overlay = container.querySelector('.loading-overlay');
    if (isLoading) {
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'loading-overlay';
            overlay.innerHTML = '<div class="spinner"></div>';
            container.appendChild(overlay);
             container.style.position = 'relative'; // Ensure overlay positions correctly
        }
        overlay.classList.remove('hidden');
    } else {
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }
}

// Show Banner Messages
function showBanner(message, type = 'success') {
    const bannerId = type === 'error' ? 'error-banner' : 'success-banner';
    const messageId = type === 'error' ? 'error-message' : 'success-message';
    const banner = document.getElementById(bannerId);
    const messageSpan = document.getElementById(messageId);

    if (banner && messageSpan) {
        messageSpan.textContent = message;
        banner.classList.remove('hidden');
        // Auto-hide after 5 seconds
        setTimeout(() => {
            banner.classList.add('hidden');
        }, 5000);
    } else {
        console[type === 'error' ? 'error' : 'log'](`Banner [${type}]: ${message}`);
    }
}

// Get Collection Name from ID (Centralized)
function getCollectionName(collectionId) {
    // This should ideally come from the API or a config
    const collectionNames = {
        'golang': 'Go Programming',
        'dsa': 'Data Structures & Algorithms',
        'engineering': 'Software Engineering',
        'network': 'Network Automation',
        // Add more as needed
    };
    return collectionNames[collectionId] || collectionId; // Fallback to ID
}

// --- API Call Functions (Mocks/Placeholders) ---
async function fetchDashboardStats() {
    // MOCK: Replace with actual API call: GET /api/stats
    console.log("Fetching dashboard stats...");
    return new Promise(resolve => setTimeout(() => resolve({
        documents: 12,
        collections: 4,
        chunks: 1532,
        embeddingDimensions: 384
    }), 500));
}

async function fetchCollections() {
    // MOCK: Replace with actual API call: GET /api/collections
    console.log("Fetching collections...");
    return new Promise(resolve => setTimeout(() => resolve([
        { id: 'golang', name: 'Go Programming', documentCount: 5, vectorCount: 613 },
        { id: 'dsa', name: 'Data Structures & Algorithms', documentCount: 3, vectorCount: 478 },
        { id: 'engineering', name: 'Software Engineering', documentCount: 2, vectorCount: 284 },
        { id: 'network', name: 'Network Automation', documentCount: 2, vectorCount: 157 }
    ]), 600));
}

async function fetchVectorData(collectionId = 'all', reductionMethod = 'tsne') {
    // MOCK: Replace with API: GET /api/vectors?collection={collectionId}&reduction={reductionMethod}
    console.log(`Fetching vector data for ${collectionId} using ${reductionMethod}...`);
    return new Promise(resolve => {
        setTimeout(() => {
            const points = [];
            const allCollectionIds = ['golang', 'dsa', 'engineering', 'network'];
            const collectionsToGenerate = collectionId === 'all' ? allCollectionIds : [collectionId];
            const baseCounts = {'golang': 613,'dsa': 478,'engineering': 284,'network': 157};

            collectionsToGenerate.forEach(colId => {
                 const count = Math.min(baseCounts[colId] || 50, 150); // Limit points for demo
                 const idx = allCollectionIds.indexOf(colId);
                 const clusterCenterX = (idx % 2) * 4 + (Math.random() - 0.5); // Spread clusters
                 const clusterCenterY = Math.floor(idx / 2) * 4 + (Math.random() - 0.5);

                 for (let i = 0; i < count; i++) {
                     // Simulate reduction method influence (more spread for PCA?)
                     const spread = reductionMethod === 'pca' ? 2.5 : 1.5;
                     points.push({
                         x: clusterCenterX + (Math.random() - 0.5) * spread,
                         y: clusterCenterY + (Math.random() - 0.5) * spread,
                         collection: colId,
                         id: `${colId}-${i}`,
                         metadata: { // Mock metadata
                             source: `${getCollectionName(colId).replace(/ /g, '_')}_doc_${i % 3 + 1}.pdf`,
                             text: `Sample text chunk ${i} related to ${getCollectionName(colId)}. Reduction: ${reductionMethod}.`,
                             similarity: null, // Similarity is usually result of search, not inherent property
                             dimensions: 384,
                             createdAt: new Date(Date.now() - Math.random() * 1e10).toISOString()
                         }
                     });
                 }
            });
            visualizationState.currentData = points; // Update global state
            resolve(points);
        }, 1200); // Simulate network delay
    });
}

async function fetchSimilarityResults(query, collectionId = 'all') {
    // MOCK: Replace with API call: GET /api/search?query={query}&collection={collectionId}
    console.log(`Searching for "${query}" in ${collectionId}...`);
    return new Promise(resolve => {
        setTimeout(() => {
             // Simple mock: return points from relevant collections with random scores
             const results = [];
             const potentialCollections = ['golang', 'dsa', 'engineering', 'network']; // Example collections
             const numResults = 5 + Math.floor(Math.random() * 5); // Random number of results

             for (let i = 0; i < numResults; i++) {
                 const colId = potentialCollections[Math.floor(Math.random() * potentialCollections.length)];
                 results.push({
                     score: Math.random() * 0.3 + 0.65, // Scores between 0.65 and 0.95
                     text: `Mock result ${i + 1} for query "${query}". This text snippet discusses relevant concepts from ${getCollectionName(colId)}.`,
                     source: `${getCollectionName(colId).replace(/ /g, '_')}_doc_${i % 2 + 1}.pdf`,
                     collectionId: colId,
                     vectorId: `${colId}-search-${i}` // Example ID
                 });
             }
             // Sort by score descending
             results.sort((a, b) => b.score - a.score);
             resolve(results);
        }, 800);
    });
}


// --- UI Update Functions ---

function updateDashboardStats(stats) {
    document.getElementById('total-documents').textContent = stats.documents || 0;
    document.getElementById('total-collections').textContent = stats.collections || 0;
    document.getElementById('total-chunks').textContent = stats.chunks || 0;
    document.getElementById('embedding-dim').textContent = stats.embeddingDimensions || 'N/A';
}

function populateCollectionDropdown(collections) {
    const dropdown = document.getElementById('collection-select');
    if (!dropdown) return;

    const currentValue = dropdown.value; // Preserve selection if possible
    dropdown.innerHTML = '<option value="all">Todas as Coleções</option>'; // Reset but keep 'All'

    collections.forEach(collection => {
        const option = document.createElement('option');
        option.value = collection.id;
        // Use counts from the fetched collections data
        option.textContent = `${collection.name} (${collection.vectorCount || collection.documentCount || 0} items)`;
        dropdown.appendChild(option);
    });
    // Restore previous selection if it still exists
    if (Array.from(dropdown.options).some(opt => opt.value === currentValue)) {
        dropdown.value = currentValue;
    }
}


function updateLegend(data) {
    const container = document.querySelector('.legend-container');
    if (!container) return;
    container.innerHTML = ''; // Clear previous legend

    if (!data || data.length === 0) return;

    const collections = [...new Set(data.map(d => d.collection))];
    const colors = getThemeColors();

    collections.forEach(collection => {
        const legendItem = document.createElement('div');
        // Use a class to indicate active state, managed by filterVisualization
        legendItem.className = `legend-item ${visualizationState.activeFilters.length === 0 || visualizationState.activeFilters.includes(collection) ? 'active' : ''}`;
        legendItem.setAttribute('data-collection-id', collection); // Store ID for click handler

        const colorBox = document.createElement('div');
        colorBox.className = 'legend-color';
        colorBox.style.backgroundColor = colors.d3ColorScale(collection);

        const label = document.createElement('span'); // Use span for text
        label.textContent = getCollectionName(collection);

        legendItem.appendChild(colorBox);
        legendItem.appendChild(label);
        container.appendChild(legendItem);
    });
}

// Update Legend UI based on activeFilters state
function updateLegendUI() {
    const legendItems = document.querySelectorAll('.legend-container .legend-item');
    legendItems.forEach(item => {
        const collectionId = item.getAttribute('data-collection-id');
        if (visualizationState.activeFilters.length === 0 || visualizationState.activeFilters.includes(collectionId)) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

function displaySimilarityResults(results) {
    const container = document.getElementById('similarity-results');
    if (!container) return;
    container.innerHTML = ''; // Clear previous

    if (!results || results.length === 0) {
        container.innerHTML = '<p class="placeholder-text">Nenhum resultado encontrado.</p>';
        return;
    }

    const countElement = document.createElement('div');
    countElement.className = 'results-count';
    countElement.textContent = `${results.length} ${results.length === 1 ? 'resultado' : 'resultados'}`;
    container.appendChild(countElement);

    results.forEach(result => {
        const item = document.createElement('div');
        item.className = 'similarity-item';
        item.setAttribute('data-vector-id', result.vectorId); // For potential future interaction
        item.setAttribute('title', `Score: ${result.score.toFixed(3)}\nSource: ${result.source}`); // Tooltip

        const scorePercent = Math.round(result.score * 100);
        item.innerHTML = `
            <div class="similarity-score">${scorePercent}%</div>
            <div class="similarity-content">
                <div class="similarity-source">
                    <i class="fas fa-file-alt"></i> ${escapeHtml(result.source)}
                </div>
                <div class="similarity-text">${escapeHtml(result.text)}</div>
            </div>
        `;
        // Add click listener to potentially highlight in visualization or show details
        item.addEventListener('click', () => {
             // Find the corresponding data point in visualizationState.currentData if IDs match
             const vectorData = visualizationState.currentData.find(v => v.id === result.vectorId);
             if (vectorData) {
                 displayVectorDetails(vectorData);
             } else {
                 // Fallback: Show basic info from result if full vector data isn't loaded/matched
                 console.warn(`Vector data for ID ${result.vectorId} not found in current visualization data.`);
                 // You could construct a basic detail view from 'result' here
                 showBanner(`Detalhes completos para ${result.vectorId} não disponíveis na visualização atual.`);
             }
        });

        container.appendChild(item);
    });
}

// --- D3 Visualization ---

async function createVectorSpaceVisualization(collectionId = 'all', reductionMethod = 'tsne') {
    const container = document.getElementById('vector-visualization');
    if (!container) {
        console.error("Container para visualização vetorial não encontrado!");
        return;
    }
    
    // Garantir que o tooltip existe
    if (!document.getElementById('visualization-tooltip')) {
        console.warn("Tooltip não encontrado no DOM, criando elemento...");
        const tooltip = document.createElement('div');
        tooltip.id = 'visualization-tooltip';
        tooltip.className = 'tooltip-container';
        document.body.appendChild(tooltip);
    }
    
    showLoading('vector-visualization', true);

    try {
        const data = await fetchVectorData(collectionId, reductionMethod);
        visualizationState.currentData = data; // Store fetched data

        // Determine which visualization type to render
        const visTypeSelect = document.getElementById('visualization-switch');
        visualizationState.currentVisualizationType = visTypeSelect ? visTypeSelect.value : 'scatter';

        updateVisualizationDisplay(); // Calls the correct render function
        updateLegend(data); // Update legend based on fetched data

    } catch (error) {
        console.error('Error creating vector visualization:', error);
        container.innerHTML = `<div class="error-message">Erro ao carregar visualização: ${error.message}</div>`;
        showBanner('Erro ao carregar visualização vetorial.', 'error');
    } finally {
        showLoading('vector-visualization', false);
    }
}


function renderVectorScatterplot(container, data, method) {
    container.innerHTML = ''; // Clear previous
    if (!data || data.length === 0) {
        container.innerHTML = '<p class="placeholder-text">Sem dados para visualização.</p>';
        return;
    }

    const colors = getThemeColors();

    // Apply filtering based on activeFilters state
    const filteredData = visualizationState.activeFilters.length > 0
        ? data.filter(d => visualizationState.activeFilters.includes(d.collection))
        : data;

    if (filteredData.length === 0 && data.length > 0) {
         container.innerHTML = '<p class="placeholder-text">Nenhum ponto corresponde aos filtros ativos.</p>';
         // Optionally, still draw axes based on 'data' extents
    }

    const plotData = filteredData.length > 0 ? filteredData : data; // Use all data if filter results in empty

    // Dimensions
    const width = container.clientWidth;
    const height = container.clientHeight || 400; // Default height if not set
    const margin = { top: 40, right: 20, bottom: 40, left: 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Scales
    const xExtent = d3.extent(plotData, d => d.x);
    const yExtent = d3.extent(plotData, d => d.y);
    const xPadding = (xExtent[1] - xExtent[0]) * 0.1; // Add 10% padding
    const yPadding = (yExtent[1] - yExtent[0]) * 0.1;

    const xScale = d3.scaleLinear()
        .domain([xExtent[0] - xPadding, xExtent[1] + xPadding])
        .range([0, innerWidth]);
    const yScale = d3.scaleLinear()
        .domain([yExtent[0] - yPadding, yExtent[1] + yPadding])
        .range([innerHeight, 0]); // Flipped for SVG coords

    // SVG Setup
    const svg = d3.select(container).append('svg')
        .attr('width', width)
        .attr('height', height);

    const mainGroup = svg.append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Zoom Behavior
    visualizationState.d3Zoom = d3.zoom()
        .scaleExtent([0.5, 8]) // Zoom range
        .extent([[0, 0], [innerWidth, innerHeight]]) // Limit panning
        .translateExtent([[0, 0], [innerWidth, innerHeight]]) // Limit panning extent
        .on('zoom', (event) => {
            mainGroup.attr('transform', `translate(${margin.left}, ${margin.top}) ${event.transform}`);
             // Adjust point size slightly on zoom for visibility? Optional.
             // points.attr('r', 4 / event.transform.k);
        });

    // Apply zoom AFTER creating the group it targets
    svg.call(visualizationState.d3Zoom);


    // Axes
    const xAxis = d3.axisBottom(xScale).ticks(5).tickSizeOuter(0);
    const yAxis = d3.axisLeft(yScale).ticks(5).tickSizeOuter(0);

    mainGroup.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0, ${innerHeight})`)
        .call(xAxis)
        .append('text')
            .attr('class', 'axis-label')
            .attr('x', innerWidth / 2)
            .attr('y', margin.bottom - 5)
            .attr('fill', colors.axisColor)
            .attr('text-anchor', 'middle')
            .text('Dimensão 1');

    mainGroup.append('g')
        .attr('class', 'y-axis')
        .call(yAxis)
         .append('text')
            .attr('class', 'axis-label')
            .attr('transform', 'rotate(-90)')
            .attr('x', -innerHeight / 2)
            .attr('y', -margin.left + 15)
            .attr('fill', colors.axisColor)
            .attr('text-anchor', 'middle')
            .text('Dimensão 2');

     // Style axes dynamically
     mainGroup.selectAll('.axis path, .axis line').attr('stroke', colors.gridColor);
     mainGroup.selectAll('.axis text').attr('fill', colors.textColor);


    // Tooltip Div (using the single instance)
    const tooltip = d3.select('#visualization-tooltip');

    // Points
    const points = mainGroup.append('g')
        .attr('class', 'points')
        .selectAll('circle')
        .data(plotData)
        .join('circle')
        .attr('cx', d => xScale(d.x))
        .attr('cy', d => yScale(d.y))
        .attr('r', 4.5)
        .attr('fill', d => colors.d3ColorScale(d.collection))
        .attr('stroke', colors.primaryBg) // Use background for stroke contrast
        .attr('stroke-width', 0.5)
        .attr('opacity', d => (visualizationState.activeFilters.length > 0 && !visualizationState.activeFilters.includes(d.collection)) ? 0.15 : 0.8) // Dim non-filtered points
        .style('cursor', 'pointer')
        .on('mouseover', function (event, d) {
            d3.select(this)
                .transition().duration(100)
                .attr('r', 7)
                .attr('stroke-width', 1.5)
                .attr('stroke', colors.highlightAlt);

            tooltip.style('display', 'block')
                   .html(`
                       <div class="tooltip-title">${d.id} (${getCollectionName(d.collection)})</div>
                       <div class="tooltip-content">
                           <div><strong>Source:</strong> ${d.metadata?.source || 'N/A'}</div>
                           ${d.metadata?.similarity ? `<div><strong>Similarity:</strong> ${d.metadata.similarity}</div>` : ''}
                       </div>
                   `);
        })
        .on('mousemove', function (event) {
            // Position tooltip near cursor
            tooltip.style('left', (event.pageX + 15) + 'px')
                   .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function () {
            d3.select(this)
                .transition().duration(100)
                .attr('r', 4.5)
                .attr('stroke-width', 0.5)
                .attr('stroke', colors.primaryBg);
            tooltip.style('display', 'none');
        })
        .on('click', function (event, d) {
            displayVectorDetails(d);
        });
}

function renderVectorBarChart(container, data) {
     container.innerHTML = ''; // Clear previous
    if (!data || data.length === 0) {
        container.innerHTML = '<p class="placeholder-text">Sem dados para visualização.</p>';
        return;
    }

    const colors = getThemeColors();

    // Group data by collection
    const counts = d3.rollup(data, v => v.length, d => d.collection);
    const countData = Array.from(counts, ([collection, count]) => ({
        collection,
        count,
        name: getCollectionName(collection)
    })).sort((a, b) => d3.descending(a.count, b.count)); // Sort bars


    // Dimensions
    const width = container.clientWidth;
    const height = container.clientHeight || 400;
    const margin = { top: 30, right: 20, bottom: 100, left: 50 }; // Increased bottom margin for labels
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Scales
    const xScale = d3.scaleBand()
        .domain(countData.map(d => d.name))
        .range([0, innerWidth])
        .padding(0.2);
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(countData, d => d.count) * 1.1]) // Add 10% headroom
        .range([innerHeight, 0]);

    // SVG Setup
    const svg = d3.select(container).append('svg')
        .attr('width', width)
        .attr('height', height);
    const mainGroup = svg.append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Axes
    const xAxis = d3.axisBottom(xScale).tickSizeOuter(0);
    const yAxis = d3.axisLeft(yScale).ticks(5).tickSizeOuter(0);

    const xAxisGroup = mainGroup.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0, ${innerHeight})`)
        .call(xAxis);

    // Rotate labels
    xAxisGroup.selectAll('text')
        .attr('transform', 'rotate(-45)')
        .attr('text-anchor', 'end')
        .attr('dx', '-0.8em')
        .attr('dy', '0.15em');

    mainGroup.append('g')
        .attr('class', 'y-axis')
        .call(yAxis)
         .append('text') // Y-axis label
            .attr('class', 'axis-label')
            .attr('transform', 'rotate(-90)')
            .attr('x', -innerHeight / 2)
            .attr('y', -margin.left + 15)
            .attr('fill', colors.axisColor)
            .attr('text-anchor', 'middle')
            .text('Número de Vetores');

     // Style axes
     mainGroup.selectAll('.axis path, .axis line').attr('stroke', colors.gridColor);
     mainGroup.selectAll('.axis text').attr('fill', colors.textColor);

     // Tooltip
     const tooltip = d3.select('#visualization-tooltip');

    // Bars
    mainGroup.selectAll('.bar')
        .data(countData)
        .join('rect')
        .attr('class', 'bar')
        .attr('x', d => xScale(d.name))
        .attr('y', d => yScale(d.count))
        .attr('width', xScale.bandwidth())
        .attr('height', d => innerHeight - yScale(d.count))
        .attr('fill', d => colors.d3ColorScale(d.collection))
        .attr('opacity', 0.8)
        .style('cursor', 'pointer')
         .on('mouseover', function (event, d) {
            d3.select(this).attr('opacity', 1);
            tooltip.style('display', 'block')
                   .html(`
                       <div class="tooltip-title">${d.name}</div>
                       <div class="tooltip-content">
                           <div><strong>Vetores:</strong> ${d.count}</div>
                       </div>
                   `);
        })
        .on('mousemove', function (event) {
            tooltip.style('left', (event.pageX + 15) + 'px')
                   .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function () {
            d3.select(this).attr('opacity', 0.8);
            tooltip.style('display', 'none');
        })
        .on('click', (event, d) => {
            // Optional: Filter scatter plot by this collection
            filterVisualization(d.collection);
            // Switch view back to scatter?
            const visSwitch = document.getElementById('visualization-switch');
            if (visSwitch) {
                visSwitch.value = 'scatter';
                switchVisualization(); // Update display
            }
        });

        // Optional: Add text labels on bars (can get cluttered)
        /*
        mainGroup.selectAll('.bar-label')
            .data(countData)
            .join('text')
            .attr('class', 'bar-label')
            .attr('x', d => xScale(d.name) + xScale.bandwidth() / 2)
            .attr('y', d => yScale(d.count) - 5)
            .attr('text-anchor', 'middle')
            .attr('fill', colors.textColor)
            .style('font-size', '10px')
            .text(d => d.count);
        */
}

function renderVectorTable(container, data) {
     container.innerHTML = ''; // Clear previous
    if (!data || data.length === 0) {
        container.innerHTML = '<p class="placeholder-text">Sem dados para visualização.</p>';
        return;
    }

    // Apply filtering
    const filteredData = visualizationState.activeFilters.length > 0
        ? data.filter(d => visualizationState.activeFilters.includes(d.collection))
        : data;

    if (filteredData.length === 0 && data.length > 0) {
         container.innerHTML = '<p class="placeholder-text">Nenhum dado corresponde aos filtros ativos.</p>';
         return;
    }

    const displayData = filteredData.slice(0, 200); // Limit rows for performance

    const tableContainer = document.createElement('div');
    tableContainer.className = 'vector-table-container'; // Ensure this class applies scroll

    const table = document.createElement('table');
    table.className = 'vector-table';

    // Header
    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    ['ID', 'Coleção', 'Fonte', 'Data Criação', 'X', 'Y'].forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        headerRow.appendChild(th);
    });

    // Body
    const tbody = table.createTBody();
    displayData.forEach(d => {
        const row = tbody.insertRow();
        row.style.cursor = 'pointer';
        row.onclick = () => displayVectorDetails(d);

        row.insertCell().textContent = d.id;
        row.insertCell().textContent = getCollectionName(d.collection);
        row.insertCell().textContent = d.metadata?.source || 'N/A';
        row.insertCell().textContent = d.metadata?.createdAt ? new Date(d.metadata.createdAt).toLocaleDateString() : 'N/A';
        row.insertCell().textContent = d.x.toFixed(4);
        row.insertCell().textContent = d.y.toFixed(4);
    });

    tableContainer.appendChild(table);

    // Pagination Info
    if (filteredData.length > displayData.length) {
        const paginationInfo = document.createElement('div');
        paginationInfo.className = 'table-pagination-info';
        paginationInfo.textContent = `Mostrando ${displayData.length} de ${filteredData.length} vetores filtrados.`;
        tableContainer.appendChild(paginationInfo);
    } else if (filteredData.length === 0 && data.length > 0) {
         // Handled above
    } else if (filteredData.length === 0 && data.length === 0) {
         // Handled above
    }


    container.appendChild(tableContainer);
}


// --- Chart.js Visualization ---

async function createCollectionDistributionChart() {
    const chartCanvas = document.getElementById('collection-distribution-chart');
    const container = chartCanvas ? chartCanvas.closest('.chart-container') : null;
    if (!chartCanvas || !container) {
        console.warn('Collection distribution chart canvas or container not found.');
        return;
    }
    showLoading(container.id || 'collection-distribution-chart-container', true); // Need an ID on container

    try {
        // Use fetched collections data for the chart
        const collections = await fetchCollections(); // Assumes this returns [{id, name, vectorCount}, ...]
        const colors = getThemeColors();

        const labels = collections.map(c => c.name);
        const vectorCounts = collections.map(c => c.vectorCount || 0);

        // Destroy previous chart instance if it exists
        if (visualizationState.chartInstance) {
            visualizationState.chartInstance.destroy();
        }

        // Create new chart
        const ctx = chartCanvas.getContext('2d');
        visualizationState.chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Número de Vetores',
                    data: vectorCounts,
                    // Use D3 scale for consistent colors, map names back to IDs if needed
                    backgroundColor: collections.map(c => colors.d3ColorScale(c.id) + 'B3'), // Add alpha
                    borderColor: collections.map(c => colors.d3ColorScale(c.id)),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y', // Horizontal bars might look better
                scales: {
                    y: { // Now the category axis
                        ticks: { color: colors.textColor },
                        grid: { display: false } // Hide vertical grid lines
                    },
                    x: { // Now the value axis
                        beginAtZero: true,
                        title: { display: true, text: 'Número de Vetores', color: colors.axisColor },
                        ticks: { color: colors.textColor, precision: 0 },
                        grid: { color: colors.gridColor }
                    }
                },
                plugins: {
                    legend: { display: false }, // Hide legend if only one dataset
                    tooltip: {
                        backgroundColor: colors.tooltipBg,
                        titleColor: colors.tooltipColor,
                        bodyColor: colors.tooltipColor,
                        callbacks: {
                            label: function(context) {
                                return ` ${context.raw.toLocaleString()} vetores`;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error creating collection distribution chart:', error);
         container.innerHTML = `<div class="error-message">Erro ao carregar gráfico: ${error.message}</div>`;
        showBanner('Erro ao carregar gráfico de distribuição.', 'error');
    } finally {
         showLoading(container.id || 'collection-distribution-chart-container', false);
    }
}


// --- Interactivity ---

// Initialize the entire dashboard (called after login)
async function initializeDashboard() {
    console.log("initializeDashboard chamado às:", new Date().toISOString());
    
    // Verifica se as dependências estão carregadas
    if (!checkDependencies()) {
        console.error("Não foi possível inicializar o dashboard porque as dependências necessárias não estão disponíveis.");
        // Mostrar mensagem de erro no painel
        const dashboardPage = document.getElementById('dashboard-page');
        if (dashboardPage) {
            dashboardPage.innerHTML = `
                <div class="error-message full-page-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Não foi possível carregar as bibliotecas necessárias para as visualizações.</p>
                    <p>Tente recarregar a página ou verifique sua conexão com a internet.</p>
                </div>`;
        }
        return;
    }

    // Add listeners specific to the dashboard elements
    const collectionSelect = document.getElementById('collection-select');
    const visTypeSelect = document.getElementById('visualization-type');
    const similarityQuery = document.getElementById('similarity-query');
    const similaritySearchBtn = document.getElementById('similarity-search-btn');
    const legendContainer = document.querySelector('.legend-container');

    // Debug: Log elementos encontrados ou não
    console.log("Dashboard elementos encontrados:", {
        collectionSelect: !!collectionSelect,
        visTypeSelect: !!visTypeSelect,
        similarityQuery: !!similarityQuery,
        similaritySearchBtn: !!similaritySearchBtn,
        legendContainer: !!legendContainer,
        vectorVisualization: !!document.getElementById('vector-visualization'),
        distChart: !!document.getElementById('collection-distribution-chart')
    });

    // Verifique se elementos críticos estão presentes
    if (!document.getElementById('vector-visualization') || !document.getElementById('collection-distribution-chart')) {
        console.error("Elementos críticos para visualização não foram encontrados no DOM.");
    }

    if (collectionSelect) {
        collectionSelect.addEventListener('change', updateVisualizationsForCollection);
    }
    if (visTypeSelect) {
        visTypeSelect.addEventListener('change', updateVectorVisualizationMethod);
    }
    if (similaritySearchBtn && similarityQuery) {
        similaritySearchBtn.addEventListener('click', performSimilaritySearch);
        similarityQuery.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Prevent form submission if it's in a form
                performSimilaritySearch();
            }
        });
         setupSimilaritySearchExtras(similarityQuery.parentNode); // Setup clear button, history
    }

     // Legend click handling (delegated)
     if (legendContainer) {
         legendContainer.addEventListener('click', (e) => {
             const legendItem = e.target.closest('.legend-item');
             if (legendItem) {
                 const collectionId = legendItem.getAttribute('data-collection-id');
                 if (collectionId) {
                     filterVisualization(collectionId);
                 }
             }
         });
     }


    // Load initial data
    try {
        showLoading('dashboard-page', true); // Show loading on the whole page initially
        const [statsData, collectionsData] = await Promise.all([
            fetchDashboardStats(),
            fetchCollections()
        ]);
        updateDashboardStats(statsData);
        populateCollectionDropdown(collectionsData); // Populate dropdown first

        // Then load visualizations using the current dropdown state
        await Promise.all([
             createVectorSpaceVisualization(collectionSelect ? collectionSelect.value : 'all', visTypeSelect ? visTypeSelect.value : 'tsne'),
             createCollectionDistributionChart() // Uses fetched collections
        ]);

        showLoading('dashboard-page', false);

    } catch (error) {
        console.error("Error initializing dashboard:", error);
        showBanner("Falha ao carregar dados do dashboard.", "error");
         showLoading('dashboard-page', false);
         // Display error message on dashboard page itself?
         const dashboardPage = document.getElementById('dashboard-page');
         if(dashboardPage) dashboardPage.innerHTML = `<div class="error-message full-page-error">Não foi possível carregar o dashboard. Erro: ${error.message}</div>`;
    }
}

// Called when collection dropdown changes
function updateVisualizationsForCollection() {
    const collectionId = document.getElementById('collection-select')?.value || 'all';
    const method = document.getElementById('visualization-type')?.value || 'tsne';
    // Reset filters when changing collection via dropdown? Optional.
    // visualizationState.activeFilters = [];
    // updateLegendUI();
    createVectorSpaceVisualization(collectionId, method);
}

// Called when reduction method dropdown changes
function updateVectorVisualizationMethod() {
    const collectionId = document.getElementById('collection-select')?.value || 'all';
    const method = document.getElementById('visualization-type')?.value || 'tsne';
    createVectorSpaceVisualization(collectionId, method);
}

// Handle similarity search action
async function performSimilaritySearch() {
    const queryInput = document.getElementById('similarity-query');
    if (!queryInput) return;
    const query = queryInput.value.trim();
    if (!query) return;

    const resultsContainer = document.getElementById('similarity-results');
    if (!resultsContainer) return;

    resultsContainer.innerHTML = ''; // Clear previous
    showLoading('similarity-results-container', true); // Assuming container ID
     const searchButton = document.getElementById('similarity-search-btn');
     if(searchButton) searchButton.disabled = true;


    // Add to history (simple array, limit size)
    if (!visualizationState.searchHistory.includes(query)) {
        visualizationState.searchHistory.unshift(query);
        if (visualizationState.searchHistory.length > 10) { // Limit history size
            visualizationState.searchHistory.pop();
        }
    }

    try {
        const collectionId = document.getElementById('collection-select')?.value || 'all';
        const results = await fetchSimilarityResults(query, collectionId);
        displaySimilarityResults(results);

        // Optional: Highlight relevant vectors in the scatter plot
        // highlightRelatedVectors(results); // Requires mapping results to existing points

    } catch (error) {
        console.error("Similarity search error:", error);
        resultsContainer.innerHTML = `<p class="placeholder-text error">Erro na busca: ${error.message}</p>`;
         showBanner("Erro ao realizar busca por similaridade.", "error");
    } finally {
        showLoading('similarity-results-container', false);
         if(searchButton) searchButton.disabled = false;
    }
}

// Setup clear button and history for similarity search
function setupSimilaritySearchExtras(formGroup) {
    if (!formGroup) return;
    const queryInput = formGroup.querySelector('#similarity-query');
    const searchBtn = formGroup.querySelector('#similarity-search-btn');
    if (!queryInput || !searchBtn) return;

    // Clear Button
    let clearBtn = formGroup.querySelector('.btn-clear');
    if (!clearBtn) {
        clearBtn = document.createElement('button');
        clearBtn.type = 'button'; // Prevent form submission
        clearBtn.className = 'btn-icon btn-clear'; // Use btn-icon style
        clearBtn.innerHTML = '<i class="fas fa-times"></i>';
        clearBtn.title = 'Limpar Busca';
        clearBtn.style.display = 'none'; // Hide initially
        searchBtn.parentNode.insertBefore(clearBtn, searchBtn.nextSibling); // Insert after search button

        clearBtn.addEventListener('click', () => {
            queryInput.value = '';
            document.getElementById('similarity-results').innerHTML = '<p class="placeholder-text">Resultados da busca aparecerão aqui.</p>';
            clearBtn.style.display = 'none';
            queryInput.focus();
        });

        queryInput.addEventListener('input', () => {
            clearBtn.style.display = queryInput.value ? 'inline-flex' : 'none';
        });
    }

    // Search History Dropdown
    let historyDropdown = formGroup.querySelector('.search-history-dropdown');
    if (!historyDropdown) {
        historyDropdown = document.createElement('div');
        historyDropdown.className = 'search-history-dropdown hidden';
        historyDropdown.id = 'search-history';
        queryInput.parentNode.appendChild(historyDropdown); // Append within the input group/form-group

        queryInput.addEventListener('focus', () => {
            updateSearchHistoryDropdown();
            if (visualizationState.searchHistory.length > 0) {
                historyDropdown.classList.remove('hidden');
            }
        });

        queryInput.addEventListener('blur', () => {
            // Delay hiding to allow clicks on history items
            setTimeout(() => historyDropdown.classList.add('hidden'), 200);
        });
    }
}

// Update search history dropdown content
function updateSearchHistoryDropdown() {
    const historyDropdown = document.getElementById('search-history');
    if (!historyDropdown) return;
    historyDropdown.innerHTML = '';

    if (visualizationState.searchHistory.length === 0) {
        historyDropdown.classList.add('hidden');
        return;
    }

    visualizationState.searchHistory.forEach(query => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.textContent = query;
        item.title = `Buscar por: ${query}`;
        // Use mousedown to register click before blur hides the dropdown
        item.addEventListener('mousedown', () => {
            document.getElementById('similarity-query').value = query;
            historyDropdown.classList.add('hidden');
            performSimilaritySearch();
        });
        historyDropdown.appendChild(item);
    });
     historyDropdown.classList.remove('hidden'); // Show if populated
}


// Toggle filter state and update visualization
function filterVisualization(collectionId) {
    const index = visualizationState.activeFilters.indexOf(collectionId);
    if (index === -1) {
        visualizationState.activeFilters.push(collectionId); // Add filter
    } else {
        visualizationState.activeFilters.splice(index, 1); // Remove filter
    }

    updateLegendUI(); // Update visual state of legend items

    // Re-render the current visualization with the new filters
    updateVisualizationDisplay();
}

// Update the main visualization area based on current type and data/filters
function updateVisualizationDisplay() {
    const container = document.getElementById('vector-visualization');
    const method = document.getElementById('visualization-type')?.value || 'tsne';
    if (!container) return;

    const dataToRender = visualizationState.currentData;

    switch (visualizationState.currentVisualizationType) {
        case 'scatter':
            renderVectorScatterplot(container, dataToRender, method);
            break;
        case 'bar':
            renderVectorBarChart(container, dataToRender);
            break;
        case 'table':
            renderVectorTable(container, dataToRender);
            break;
        default:
             console.warn(`Unknown visualization type: ${visualizationState.currentVisualizationType}`);
             renderVectorScatterplot(container, dataToRender, method); // Fallback to scatter
    }
}

// Export current data
function exportData(format) {
    if (!visualizationState.currentData || visualizationState.currentData.length === 0) {
        showBanner('Nenhum dado disponível para exportar', 'error');
        return;
    }

    // Use filtered data if filters are active? Or always export all loaded data?
    // Let's export only the currently *displayed* data (respecting filters)
    let dataToExport = visualizationState.currentData;
     if (visualizationState.activeFilters.length > 0) {
         dataToExport = visualizationState.currentData.filter(d => visualizationState.activeFilters.includes(d.collection));
     }
      if (dataToExport.length === 0) {
        showBanner('Nenhum dado corresponde aos filtros ativos para exportar', 'error');
        return;
    }


    try {
        let dataStr;
        let mimeType;
        let fileName = `llm-go-qdrant-export-${new Date().toISOString().split('T')[0]}`;

        if (format === 'csv') {
            mimeType = 'text/csv;charset=utf-8;';
            // Flatten metadata for CSV columns (basic example)
            const headers = ['id', 'collection', 'x', 'y', 'source', 'createdAt', 'text_snippet'];
            const csvRows = [headers.join(',')];
            dataToExport.forEach(item => {
                 // Escape commas and quotes in text snippet
                 const textSnippet = (item.metadata?.text || '').substring(0, 100).replace(/"/g, '""');
                 const row = [
                     item.id,
                     item.collection,
                     item.x?.toFixed(4) || '',
                     item.y?.toFixed(4) || '',
                     item.metadata?.source || '',
                     item.metadata?.createdAt || '',
                     `"${textSnippet}"` // Enclose in quotes
                 ];
                 csvRows.push(row.join(','));
            });
            dataStr = csvRows.join('\r\n'); // Use CRLF for better Excel compatibility
            fileName += '.csv';
        } else if (format === 'json') {
            mimeType = 'application/json;charset=utf-8;';
            dataStr = JSON.stringify(dataToExport, null, 2); // Pretty print JSON
            fileName += '.json';
        } else {
            throw new Error(`Formato de exportação não suportado: ${format}`);
        }

        const blob = new Blob([dataStr], { type: mimeType });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link); // Required for Firefox
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        showBanner(`Dados exportados com sucesso como ${format.toUpperCase()}`, 'success');

    } catch (error) {
        console.error("Error exporting data:", error);
        showBanner(`Falha ao exportar dados como ${format.toUpperCase()}: ${error.message}`, 'error');
    }
}


// Display vector details in a modal
function displayVectorDetails(vectorData) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) {
        console.error("Modal container not found.");
        return;
    }

    // Close any existing modal first
    const existingModal = modalContainer.querySelector('.modal');
    if (existingModal) modalContainer.removeChild(existingModal);

    const colors = getThemeColors(); // Get current theme colors

    // Create modal structure dynamically
    const modal = document.createElement('div');
    modal.id = 'detail-view-modal';
    modal.className = 'modal'; // Add 'modal' class for basic structure

    const content = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 id="detail-view-title">Detalhes do Vetor: ${escapeHtml(vectorData.id)}</h3>
                <button class="close-modal" title="Fechar">&times;</button>
            </div>
            <div class="modal-body">
                <div id="detail-view-content">
                    <div class="detail-section">
                        <div class="detail-header">Informações Básicas</div>
                        <div class="detail-row">
                            <div class="detail-label">Coleção:</div>
                            <div class="detail-value" style="color: ${colors.d3ColorScale(vectorData.collection)}; font-weight: bold;">${getCollectionName(vectorData.collection)}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Fonte:</div>
                            <div class="detail-value">${escapeHtml(vectorData.metadata?.source) || 'N/A'}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Data Criação:</div>
                            <div class="detail-value">${vectorData.metadata?.createdAt ? new Date(vectorData.metadata.createdAt).toLocaleString() : 'N/A'}</div>
                        </div>
                    </div>
                     <div class="detail-section">
                        <div class="detail-header">Informações Vetoriais</div>
                        <div class="detail-row">
                            <div class="detail-label">Dimensões:</div>
                            <div class="detail-value">${vectorData.metadata?.dimensions || 'N/A'}</div>
                        </div>
                        ${vectorData.x !== undefined ? `
                        <div class="detail-row">
                            <div class="detail-label">Coord. X (${document.getElementById('visualization-type')?.value || 'N/A'}):</div>
                            <div class="detail-value">${vectorData.x.toFixed(4)}</div>
                        </div>` : ''}
                         ${vectorData.y !== undefined ? `
                        <div class="detail-row">
                            <div class="detail-label">Coord. Y (${document.getElementById('visualization-type')?.value || 'N/A'}):</div>
                            <div class="detail-value">${vectorData.y.toFixed(4)}</div>
                        </div>` : ''}
                        ${vectorData.metadata?.similarity !== null && vectorData.metadata?.similarity !== undefined ? `
                        <div class="detail-row">
                            <div class="detail-label">Similaridade (Busca):</div>
                            <div class="detail-value">${vectorData.metadata.similarity}</div>
                        </div>` : ''}
                    </div>
                    <div class="detail-section">
                        <div class="detail-header">Texto Associado</div>
                        <div class="detail-content">
                            <p>${escapeHtml(vectorData.metadata?.text) || 'Nenhum texto disponível.'}</p>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary close-modal">Fechar</button>
            </div>
        </div>
    `;

    modal.innerHTML = content;
    modalContainer.appendChild(modal);
    modalContainer.classList.remove('hidden'); // Show overlay

    // Add close listeners
    modal.querySelectorAll('.close-modal').forEach(button => {
        button.addEventListener('click', () => {
            modalContainer.classList.add('hidden');
            modalContainer.innerHTML = ''; // Clean up modal from DOM
        });
    });

     // Optional: Close modal on overlay click
     modalContainer.addEventListener('click', (e) => {
         if (e.target === modalContainer) {
             modalContainer.classList.add('hidden');
             modalContainer.innerHTML = '';
         }
     }, { once: true }); // Use once to avoid issues if content has overlays
}


// --- Adicionar funções importantes ao escopo global do window ---

// Expõe funções essenciais para o escopo global window
// Isso é importante para que o dark mode e outras funções possam utilizá-las
window.createVectorSpaceVisualization = createVectorSpaceVisualization;
window.createCollectionDistributionChart = createCollectionDistributionChart; 
window.updateVisualizationDisplay = updateVisualizationDisplay;
window.initializeDashboard = initializeDashboard;
window.getThemeColors = getThemeColors;

// --- Make functions globally accessible if needed ---
// (Needed for inline onclick attributes in HTML, though delegated events are better)
window.toggleDarkMode = window.toggleDarkMode || function() {}; // Preserve if already defined in HTML
window.filterVisualization = filterVisualization;
window.exportData = exportData;
window.switchVisualization = function() {
     const visSwitch = document.getElementById('visualization-switch');
     if (visSwitch) {
         visualizationState.currentVisualizationType = visSwitch.value;
         updateVisualizationDisplay();
     }
 };

// Debug: Log quando foi concluído o carregamento do visualizations.js
console.log("visualizations.js completamente carregado às:", new Date().toISOString());