/* js/modules/weather.js */
let rainViewerLayer2D = null;
let rainViewerLayer3D = null;

export function initWeatherModule(map2D, viewer3D) {
    const chkRain = document.getElementById('chk-weather-radar');

    chkRain?.addEventListener('change', async (e) => {
        if (e.target.checked) {
            try {
                const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
                const data = await res.json();
                if (data.radar && data.radar.past && data.radar.past.length > 0) {
                    const latest = data.radar.past[data.radar.past.length - 1].path;
                    const tileUrl = `https://tilecache.rainviewer.com${latest}/256/{z}/{x}/{y}/2/1_1.png`;

                    // ۲D Tile Layer
                    rainViewerLayer2D = L.tileLayer(tileUrl, { opacity: 0.6 }).addTo(map2D);

                    // ۳D Imagery Provider
                    if (viewer3D) {
                        rainViewerLayer3D = viewer3D.imageryLayers.addImageryProvider(
                            new Cesium.UrlTemplateImageryProvider({
                                url: tileUrl,
                                maximumLevel: 18
                            })
                        );
                        rainViewerLayer3D.alpha = 0.6;
                    }
                }
            } catch (err) {
                console.error("خطا در بارگذاری رادار بارش:", err);
            }
        } else {
            if (rainViewerLayer2D) map2D.removeLayer(rainViewerLayer2D);
            if (viewer3D && rainViewerLayer3D) viewer3D.imageryLayers.remove(rainViewerLayer3D);
        }
    });
}
