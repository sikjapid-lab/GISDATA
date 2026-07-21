/**
 * ماژول ترافیک زنده
 */
export function initTrafficModule(map) {
    const googleTrafficLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m@159000000,traffic&hl=fa&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        opacity: 0.8
    });

    document.getElementById('chk-traffic-google')?.addEventListener('change', (e) => {
        e.target.checked ? map.addLayer(googleTrafficLayer) : map.removeLayer(googleTrafficLayer);
    });

    let tomTomFlowLayer = null;
    document.getElementById('chk-traffic-tomtom')?.addEventListener('change', (e) => {
        if (e.target.checked) {
            const apiKey = localStorage.getItem('API_TOMTOM') || '';
            if (!apiKey) {
                alert('لطفاً ابتدا TomTom API Key را در بخش تنظیمات وارد کنید.');
                e.target.checked = false;
                return;
            }
            tomTomFlowLayer = L.tileLayer(`https://api.tomtom.com/traffic/map/4/tile/flow/relative-delay/{z}/{x}/{y}.png?key=${apiKey}&style=night`, { maxZoom: 18, opacity: 0.85 });
            map.addLayer(tomTomFlowLayer);
        } else if (tomTomFlowLayer) {
            map.removeLayer(tomTomFlowLayer);
        }
    });

    let tomTomIncidentsLayer = null;
    document.getElementById('chk-traffic-tomtom-incidents')?.addEventListener('change', (e) => {
        if (e.target.checked) {
            const apiKey = localStorage.getItem('API_TOMTOM') || '';
            if (!apiKey) {
                alert('لطفاً ابتدا TomTom API Key را در بخش تنظیمات وارد کنید.');
                e.target.checked = false;
                return;
            }
            tomTomIncidentsLayer = L.tileLayer(`https://api.tomtom.com/traffic/map/4/tile/incidents/s3/{z}/{x}/{y}.png?key=${apiKey}&style=night`, { maxZoom: 18, opacity: 0.9 });
            map.addLayer(tomTomIncidentsLayer);
        } else if (tomTomIncidentsLayer) {
            map.removeLayer(tomTomIncidentsLayer);
        }
    });
}
