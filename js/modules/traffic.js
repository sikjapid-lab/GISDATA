/* js/modules/traffic.js */
let googleTrafficLayer2D = null;

export function initTrafficModule(map2D, viewer3D) {
    const chkGoogle = document.getElementById('chk-traffic-google');

    chkGoogle?.addEventListener('change', (e) => {
        if (e.target.checked) {
            googleTrafficLayer2D = L.tileLayer('https://mt1.google.com/vt/lyrs=m,traffic&x={x}&y={y}&z={z}', {
                maxZoom: 21,
                opacity: 0.7
            }).addTo(map2D);
        } else {
            if (googleTrafficLayer2D) {
                map2D.removeLayer(googleTrafficLayer2D);
                googleTrafficLayer2D = null;
            }
        }
    });
}
