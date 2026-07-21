/**
 * ماژول ترافیک زنده
 */
export function initTrafficModule(map) {
    const googleTrafficLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m@159000000,traffic&hl=en&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        opacity: 0.8
    });

    document.getElementById('chk-traffic-google')?.addEventListener('change', (e) => {
        e.target.checked ? map.addLayer(googleTrafficLayer) : map.removeLayer(googleTrafficLayer);
    });

    let tomTomLayer = null;

    document.getElementById('chk-traffic-tomtom')?.addEventListener('change', (e) => {
        if (e.target.checked) {
            const apiKey = localStorage.getItem('API_TOMTOM') || '';
            if (!apiKey) {
                alert('لطفاً ابتدا TomTom API Key را در بخش تنظیمات وارد کنید.');
                e.target.checked = false;
                return;
            }
            tomTomLayer = L.tileLayer(`https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${apiKey}`, { opacity: 0.8 });
            map.addLayer(tomTomLayer);
        } else if (tomTomLayer) {
            map.removeLayer(tomTomLayer);
        }
    });
}
