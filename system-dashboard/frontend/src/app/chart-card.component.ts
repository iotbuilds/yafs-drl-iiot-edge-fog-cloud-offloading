import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild } from '@angular/core';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-chart-card',
  standalone: true,
  template: `
    <div class="yafs-chart-card">
      <h2 class="yafs-chart-title">{{ title }}</h2>
      <div class="yafs-chart-body"><canvas #canvas class="chart-canvas"></canvas></div>
    </div>
  `
})
export class ChartCardComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) title = '';
  @Input({ required: true }) config: any;
  @ViewChild('canvas') canvas?: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;

  ngAfterViewInit() {
    this.render();
  }

  ngOnChanges() {
    this.render();
  }

  ngOnDestroy() {
    this.chart?.destroy();
  }

  private render() {
    if (!this.canvas || !this.config) return;
    this.chart?.destroy();

    const light = document.documentElement.classList.contains('cloud-light');
    const textColor = light ? '#141827' : '#eceefa';
    const mutedColor = light ? '#475467' : '#9da1c1';
    const gridColor = light ? 'rgba(102,112,133,0.22)' : 'rgba(52,53,95,0.72)';
    const cardColor = light ? '#ffffff' : '#1d1d3a';
    const borderColor = light ? '#d7dbea' : '#34355f';

    this.chart = new Chart(this.canvas.nativeElement, {
      ...this.config,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        color: textColor,
        layout: { padding: 2 },
        plugins: {
          legend: {
            labels: {
              color: mutedColor,
              boxWidth: 10,
              boxHeight: 10,
              font: { size: 11, weight: 600 }
            }
          },
          tooltip: {
            titleColor: textColor,
            bodyColor: textColor,
            backgroundColor: cardColor,
            borderColor,
            borderWidth: 1,
            cornerRadius: 8,
            titleFont: { size: 12 },
            bodyFont: { size: 12 }
          },
          ...(this.config.options?.plugins ?? {})
        },
        scales: this.config.type === 'doughnut' ? undefined : {
          x: { ticks: { color: mutedColor, font: { size: 10 } }, grid: { color: gridColor } },
          y: { ticks: { color: mutedColor, font: { size: 10 } }, grid: { color: gridColor } }
        },
        ...(this.config.options ?? {})
      }
    });
  }
}
