(() => {
  function cssVar(name) {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
  }

  function withAlpha(hex, alpha) {
    return hex + alpha;
  }

  var palette = {
    accent: cssVar("--accent"),
    primary: cssVar("--primary"),
    blue: cssVar("--blue"),
    orange: cssVar("--orange"),
    red: cssVar("--red"),
    green: cssVar("--green"),
    muted: cssVar("--muted"),
    line: cssVar("--line"),
    ink: cssVar("--ink"),
    paper: cssVar("--paper"),
  };

  var STATUS_COLOR = {
    pendiente: palette.muted,
    activa: palette.primary,
    revision: palette.orange,
    completada: palette.green,
    bloqueada: palette.red,
    cancelada: palette.muted,
  };

  var STATUS_LABEL = {
    pendiente: "Pendiente",
    activa: "Activa",
    revision: "Revisión",
    completada: "Completada",
    bloqueada: "Bloqueada",
    cancelada: "Cancelada",
  };

  if (window.Chart) {
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.font.family = "'Poppins','Segoe UI',Arial,sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.color = palette.muted;
    Chart.defaults.borderColor = palette.line;
    Chart.defaults.plugins.tooltip.backgroundColor = palette.paper;
    Chart.defaults.plugins.tooltip.titleColor = palette.ink;
    Chart.defaults.plugins.tooltip.bodyColor = palette.ink;
    Chart.defaults.plugins.tooltip.borderColor = palette.line;
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.displayColors = false;
  }

  function doughnutByStatus(canvas, counts) {
    var entries = Object.keys(counts).filter((k) => counts[k] > 0);
    if (!entries.length) return null;
    return new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: entries.map((k) => STATUS_LABEL[k] || k),
        datasets: [
          {
            data: entries.map((k) => counts[k]),
            backgroundColor: entries.map(
              (k) => STATUS_COLOR[k] || palette.muted,
            ),
            borderWidth: 0,
          },
        ],
      },
      options: {
        cutout: "68%",
        plugins: {
          legend: {
            position: "bottom",
            labels: { usePointStyle: true, boxWidth: 7, padding: 12 },
          },
        },
      },
    });
  }

  function areaSeries(canvas, labels, values) {
    return new Chart(canvas, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            data: values,
            borderColor: palette.accent,
            backgroundColor: withAlpha(palette.accent, "26"),
            fill: true,
            tension: 0.35,
            pointRadius: 0,
            borderWidth: 2,
          },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, grid: { color: palette.line } },
        },
      },
    });
  }

  function barByCategory(canvas, labels, values, color) {
    return new Chart(canvas, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            data: values,
            backgroundColor: color || palette.accent,
            borderRadius: 6,
            maxBarThickness: 34,
          },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, grid: { color: palette.line } },
        },
      },
    });
  }

  window.AIAcademyCharts = {
    palette: palette,
    statusColor: STATUS_COLOR,
    statusLabel: STATUS_LABEL,
    doughnutByStatus: doughnutByStatus,
    areaSeries: areaSeries,
    barByCategory: barByCategory,
  };
})();
