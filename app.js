const DRIVER_NUMBER = 5;
const BASE_URL = 'https://api.openf1.org/v1';

let telemetryChart;
let mapCanvas = document.getElementById('trackMap');
let mapCtx = mapCanvas.getContext('2d');
let trackHistory = [];

let allSessions = [];

async function setupHistoryFilters() {
    const gpSelect = document.getElementById('select-gp');
    const sessionSelect = document.getElementById('select-session');
    const loadBtn = document.getElementById('btn-load-data');
    const statusInfo = document.getElementById('session-status');

    try {
        const response = await fetch(`${BASE_URL}/sessions?year=2026`);
        allSessions = await response.json();

        // Extrai locais únicos para o primeiro dropdown
        const uniqueGPs = [...new Set(allSessions.map(s => s.location))];
        uniqueGPs.forEach(gp => {
            const opt = document.createElement('option');
            opt.value = gp;
            opt.innerText = gp.toUpperCase();
            gpSelect.appendChild(opt);
        });

        // Evento ao escolher o GP
        gpSelect.onchange = () => {
            sessionSelect.innerHTML = '<option value="">Selecione a Sessão...</option>';
            const filtered = allSessions.filter(s => s.location === gpSelect.value);

            filtered.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.session_key;
                opt.innerText = s.session_name;
                sessionSelect.appendChild(opt);
            });

            sessionSelect.disabled = false;
            loadBtn.disabled = true;
        };

        // Evento ao escolher a sessão
        sessionSelect.onchange = () => {
            const selectedSession = allSessions.find(s => s.session_key == sessionSelect.value);
            if (selectedSession) {
                const date = new Date(selectedSession.date_start).toLocaleDateString();
                statusInfo.innerText = `${date} | CONCLUÍDA`;
                loadBtn.disabled = false;
            }
        };

        // Carregar os dados no Dashboard
        loadBtn.onclick = () => {
            const sKey = sessionSelect.value;
            // Limpa dados atuais antes de carregar histórico
            trackHistory = [];
            telemetryChart.data.labels = [];
            telemetryChart.data.datasets[0].data = [];

            // Inicia o loop de atualização com a nova chave
            clearInterval(updateInterval); // Certifique-se de definir updateInterval globalmente
            updateInterval = setInterval(() => updateData(sKey), 1000);

            alert(`Dashboard atualizado para: ${gpSelect.value} - ${sessionSelect.options[sessionSelect.selectedIndex].text}`);
        };

    } catch (e) { console.error("Erro nos filtros", e); }
}

// Chame no seu main()
// 

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
    loadRaceHistory();
    setupHistoryFilters();

    setInterval(() => updateData(sKey), 1000);
}

async function loadRaceHistory() {
    const historyBody = document.getElementById('history-body');

    try {
        // Buscamos todas as sessões do ano de 2026
        const response = await fetch(`${BASE_URL}/sessions?year=2026`);
        const sessions = await response.json();

        // Invertemos para mostrar as mais recentes primeiro
        sessions.reverse().forEach(session => {
            const row = document.createElement('tr');

            // Formatando a data
            const date = new Date(session.date_start).toLocaleDateString('pt-BR');

            row.innerHTML = `
                <td><strong>${session.location.toUpperCase()}</strong></td>
                <td>${session.session_name}</td>
                <td>${date}</td>
                <td><span class="status-chip">Concluída</span></td>
            `;

            // BÔNUS: Ao clicar na linha, o dashboard foca nessa corrida antiga
            row.onclick = () => {
                alert(`Carregando dados históricos de: ${session.location}`);
                // Aqui você poderia chamar updateData(session.session_key) 
                // para ver a telemetria daquela corrida específica!
            };

            historyBody.appendChild(row);
        });
    } catch (error) {
        console.error("Erro ao carregar histórico:", error);
        historyBody.innerHTML = "<tr><td colspan='4'>Erro ao carregar dados.</td></tr>";
    }
}

// Chame a função no início do seu método main()

main();