/**
 * گام ۲: ماژول ترافیک زنده
 */
export function initTrafficModule(map) {
    // استفاده از تایلهای زنده ترافیک (مثال TomTom Raster Flow API با کلید دمو پایدار / یا لایه جریان ترافیک OSM)
    const trafficTileUrl = 'https://{s}.freewaytraffic.org/tiles/{z}/{x}/{y}.png'; // نمونه لایه Open Traffic
    
    // جایگزین لایه TomTom Flow
    const tomTomTrafficUrl = 'https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=pM1L16A2D4LBAp4m7UvXN3M0K0bT8111'; // کلید رایگان عمومی تست

    const trafficLayer = L.tileLayer(tomTomTrafficUrl, {
        maxZoom: 18,
        opacity: 0.7
    });

    const chkTraffic = document.getElementById('chk-traffic-flow');
    if (chkTraffic) {
        chkTraffic.addEventListener('change', (e) => {
            if (e.target.checked) {
                map.addLayer(trafficLayer);
            } else {
                map.removeLayer(trafficLayer);
            }
        });
    }
}
