const DRIVER_NUMBER = 5; 
const BASE_URL = 'https://api.openf1.org/v1';

let telemetryChart;
let mapCanvas = document.getElementById('trackMap');
let mapCtx = mapCanvas.getContext('2d');
let trackHistory = [];

// Configuração inicial do gráfico
function initChart() {
    const ctx = document.getElementById('telemetryChart').getContext('2d');
    telemetryChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'VELOCIDADE TRANSMISSÃO',
                data: [],
                borderColor: '#e10600',
                backgroundColor: 'rgba(225, 6, 0, 0.1)',
                fill: true,
                borderWidth: 3,
                pointRadius: 0,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { grid: { color: '#333' }, ticks: { color: '#aaa' } },
                x: { display: false }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// Busca a sessão mais recente de 2026
async function fetchSession() {
    const res = await fetch(`${BASE_URL}/sessions?year=2026`);
    const data = await res.json();
    const latest = data[data.length - 1];
    document.getElementById('session-info').innerText = `${latest.location.toUpperCase()} - ${latest.session_name.toUpperCase()}`;
    return latest.session_key;
}

// Atualiza Telemetria e Mapa
async function updateData(sessionKey) {
    try {
        // 1. Telemetria
        const telRes = await fetch(`${BASE_URL}/car_data?driver_number=${DRIVER_NUMBER}&session_key=${sessionKey}`);
        const telData = await telRes.json();
        
        if (telData.length > 0) {
            const last = telData[telData.length - 1];
            document.getElementById('speed-value').innerText = last.speed;
            document.getElementById('gear-value').innerText = last.n_gear;
            document.getElementById('rpm-value').innerText = last.rpm;

            // Gráfico
            if (telemetryChart.data.labels.length > 30) {
                telemetryChart.data.labels.shift();
                telemetryChart.data.datasets[0].data.shift();
            }
            telemetryChart.data.labels.push("");
            telemetryChart.data.datasets[0].data.push(last.speed);
            telemetryChart.update('none');
        }

        // 2. Mapa (Location)
        const locRes = await fetch(`${BASE_URL}/location?driver_number=${DRIVER_NUMBER}&session_key=${sessionKey}`);
        const locData = await locRes.json();
        if (locData.length > 0) {
            trackHistory = locData.slice(-200); // Últimos 200 pontos para o traçado
            drawTrack();
        }

    } catch (err) {
        console.error("Erro na atualização:", err);
    }
}

function drawTrack() {
    mapCtx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
    
    // Configurações de desenho
    mapCtx.strokeStyle = '#38383f';
    mapCtx.lineWidth = 4;
    mapCtx.lineJoin = 'round';
    
    if (trackHistory.length === 0) return;

    // Centralização simples
    const offsetX = mapCanvas.width / 2;
    const offsetY = mapCanvas.height / 2;
    const scale = 0.04; 

    mapCtx.beginPath();
    trackHistory.forEach((p, i) => {
        const x = offsetX + (p.x * scale);
        const y = offsetY - (p.y * scale); // Inverte Y para orientação do mapa
        if (i === 0) mapCtx.moveTo(x, y);
        else mapCtx.lineTo(x, y);
    });
    mapCtx.stroke();

    // Ponto atual do Bortoleto
    const last = trackHistory[trackHistory.length - 1];
    mapCtx.fillStyle = '#e10600';
    mapCtx.shadowBlur = 15;
    mapCtx.shadowColor = "red";
    mapCtx.beginPath();
    mapCtx.arc(offsetX + (last.x * scale), offsetY - (last.y * scale), 8, 0, Math.PI * 2);
    mapCtx.fill();
    mapCtx.shadowBlur = 0;
}

// Iniciar
async function main() {
    initChart();
    const sKey = await fetchSession();
    // Ajuste o tamanho do canvas para o container
    mapCanvas.width = mapCanvas.offsetWidth;
    mapCanvas.height = mapCanvas.offsetHeight;
    
    setInterval(() => updateData(sKey), 1000);
}

main();