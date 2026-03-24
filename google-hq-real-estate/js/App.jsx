const { useState, useEffect, useRef } = React;

// Simple Icon Component using Lucide
const Icon = ({ name, size = 24, className = "" }) => {
    const iconData = window.lucide?.icons?.[name];
    if (!iconData) return null;

    // Lucide icons are defined as [tag, attrs, children]
    // But the CDN object content might vary. 
    // Safest with CDN is to just use HTML replacement or basic SVG construction if we knew the path.
    // For prototype speed without build, let's use a simpler approach: 
    // accessing the toSVG method of the icon object if available, or just innerHTML.

    // Actually, looking at lucide CDN, it exposes `lucide.icons` which are objects with `toSvg()`.
    // Let's rely on that.

    const svgString = iconData.toSvg({
        'class': className,
        'width': size,
        'height': size,
        'stroke-width': 2
    });

    return <span dangerouslySetInnerHTML={{ __html: svgString }} className="flex items-center justify-center" />;
};

const PropertyCard = ({ property, onClose }) => {
    if (!property) return null;

    return (
        <div className="absolute bottom-6 left-6 right-6 md:left-auto md:right-6 md:width-96 bg-white glass rounded-3xl p-0 shadow-2xl animate-fade-in z-[1000] overflow-hidden md:w-[400px]">
            <div className="relative h-48">
                <img
                    src={property.image}
                    alt={property.type}
                    className="w-full h-full object-cover"
                />
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm transition"
                >
                    <Icon name="X" size={20} />
                </button>
                <div className="absolute bottom-4 left-4 bg-black/60 text-white px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm">
                    {property.type}
                </div>
            </div>

            <div className="p-6">
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">{property.price}</h2>
                        <p className="text-gray-500 text-sm mt-1">{property.address}</p>
                    </div>
                </div>

                <div className="flex gap-4 mt-6 text-gray-700">
                    <div className="flex items-center gap-2">
                        <Icon name="Bed" size={18} className="text-blue-500" />
                        <span className="font-medium">{property.beds}</span>
                        <span className="text-xs text-gray-400">bd</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Icon name="Bath" size={18} className="text-blue-500" />
                        <span className="font-medium">{property.baths}</span>
                        <span className="text-xs text-gray-400">ba</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Icon name="Square" size={18} className="text-blue-500" />
                        <span className="font-medium">{property.sqft}</span>
                        <span className="text-xs text-gray-400">sqft</span>
                    </div>
                </div>

                <div className="mt-8 flex gap-3">
                    <button className="flex-1 bg-gray-900 hover:bg-gray-800 text-white py-3 rounded-xl font-medium transition shadow-lg shadow-gray-200 active:scale-95">
                        View Details
                    </button>
                    <button className="p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition text-gray-600">
                        <Icon name="Heart" size={24} />
                    </button>
                </div>
            </div>
        </div>
    );
};

const MapComponent = ({ properties, onSelectProperty, selectedProperty }) => {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersRef = useRef({});

    useEffect(() => {
        if (!mapRef.current) return;

        // Initialize Map
        const map = L.map(mapRef.current, {
            zoomControl: false,
            attributionControl: false
        }).setView(window.GOOGLE_HQ, 14);

        // Add Tile Layer (CartoDB Positron for clean look)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);

        // Add Zoom Control
        L.control.zoom({
            position: 'bottomleft'
        }).addTo(map);

        // Add Google HQ Marker
        const googleIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color: #EA4335; width: 100%; height: 100%; border-radius: 50%; box-shadow: 0 0 0 4px rgba(234, 67, 53, 0.3);"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        L.marker(window.GOOGLE_HQ, { icon: googleIcon }).addTo(map)
            .bindPopup("Google HQ")
            .openPopup();

        mapInstanceRef.current = map;

        return () => {
            map.remove();
        };
    }, []);

    // Handle Properties Markers
    useEffect(() => {
        if (!mapInstanceRef.current) return;

        const map = mapInstanceRef.current;

        // Clear existing markers
        Object.values(markersRef.current).forEach(marker => marker.remove());
        markersRef.current = {};

        properties.forEach(property => {
            const isSelected = selectedProperty?.id === property.id;

            // Custom Marker Icon
            const iconHtml = `
                <div style="
                    background-color: ${isSelected ? '#1a73e8' : '#fff'};
                    color: ${isSelected ? '#fff' : '#1a73e8'};
                    padding: 6px 10px;
                    border-radius: 12px;
                    font-weight: bold;
                    font-family: sans-serif;
                    box-shadow: 0 3px 6px rgba(0,0,0,0.2);
                    border: 2px solid #1a73e8;
                    white-space: nowrap;
                    font-size: 14px;
                    transition: all 0.2s ease;
                    transform: ${isSelected ? 'scale(1.1)' : 'scale(1)'};
                ">
                    ${property.price}
                </div>
            `;

            const icon = L.divIcon({
                className: 'custom-price-marker',
                html: iconHtml,
                iconSize: [100, 30], // Approximate size, handled by CSS mostly
                iconAnchor: [50, 40]
            });

            const marker = L.marker([property.lat, property.lng], { icon })
                .addTo(map)
                .on('click', () => {
                    onSelectProperty(property);
                    map.flyTo([property.lat, property.lng], 16, {
                        animate: true,
                        duration: 0.8
                    });
                });

            markersRef.current[property.id] = marker;
        });

    }, [properties, selectedProperty, onSelectProperty]);

    return <div ref={mapRef} className="map-container" />;
};

const Sidebar = ({ properties, onSelect, selectedId }) => {
    return (
        <div className="hidden md:flex flex-col w-96 h-screen bg-white/90 backdrop-blur-md border-r border-gray-200 z-[1000] overflow-hidden absolute top-0 left-0 shadow-2xl">
            <div className="p-6 border-b border-gray-100 bg-white/50">
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-red-500">
                    G-RealEstate
                </h1>
                <p className="text-sm text-gray-500 mt-1">Properties near Googleplex</p>

                <div className="mt-4 relative">
                    <input
                        type="text"
                        placeholder="Search properties..."
                        className="w-full bg-gray-100 border-none rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
                    />
                    <div className="absolute left-3 top-3 text-gray-400">
                        <Icon name="Search" size={18} />
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {properties.map(property => (
                    <div
                        key={property.id}
                        onClick={() => onSelect(property)}
                        className={`
                            p-3 rounded-2xl cursor-pointer transition flex gap-4 border
                            ${selectedId === property.id
                                ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-300'
                                : 'bg-white border-transparent hover:border-gray-200 hover:shadow-md'}
                        `}
                    >
                        <img
                            src={property.image}
                            className="w-24 h-24 rounded-xl object-cover"
                            alt="Property"
                        />
                        <div className="flex flex-col justify-center">
                            <h3 className="font-bold text-gray-900">{property.price}</h3>
                            <p className="text-xs text-gray-500 truncate w-40">{property.address}</p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                                <span className="flex items-center gap-1">
                                    <Icon name="Bed" size={12} /> {property.beds}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Icon name="Bath" size={12} /> {property.baths}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const App = () => {
    const [selectedProperty, setSelectedProperty] = useState(null);

    return (
        <div className="relative w-full h-screen overflow-hidden font-sans">
            <Sidebar
                properties={window.MOCK_PROPERTIES}
                onSelect={setSelectedProperty}
                selectedId={selectedProperty?.id}
            />

            <div className="md:pl-96 w-full h-full relative">
                <MapComponent
                    properties={window.MOCK_PROPERTIES}
                    onSelectProperty={setSelectedProperty}
                    selectedProperty={selectedProperty}
                />

                <PropertyCard
                    property={selectedProperty}
                    onClose={() => setSelectedProperty(null)}
                />

                {/* Floating Action Button (Mobile) */}
                <button className="md:hidden absolute top-4 right-4 z-[1000] bg-white p-3 rounded-full shadow-lg text-gray-700">
                    <Icon name="Menu" size={24} />
                </button>
            </div>
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
