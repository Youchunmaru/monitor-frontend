import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts'; // Chart.js wrapper
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { TelemetryService, Machine } from './telemetry.service';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseChartDirective],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  machines: Machine[] = [];
  selectedMachine: Machine | null = null;

  // Form inputs
  newMachineName = '';
  newMachineIp = '127.0.0.1';

  // Chart Configuration
  public lineChartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [{ data: [], label: 'CPU Load %', borderColor: 'black', backgroundColor: 'rgba(0,0,0,0.1)', fill: true }]
  };
  public lineChartOptions: ChartOptions<'line'> = { responsive: true };

  constructor(private service: TelemetryService) { }

  ngOnInit() {
    // 1. Initial Load (GraphQL)
    this.service.getMachines().subscribe(data => {
      this.machines = data ? data.map(m => ({ ...m, currentCpu: 0 })) as Machine[] : [] as Machine[]; // Initialize with 0
    });

    // 2. Real-time Updates (Socket.IO)
    this.service.getRealtimeUpdates().subscribe(update => {
      // Find the machine in our list and update its CPU
      const machine = this.machines.find(m => m.id === update.machineId);
      if (machine) {
        machine.currentCpu = update.cpu;
      }
    });
  }

  addNew() {
    // Call REST API
    this.service.addMachine(this.newMachineName, this.newMachineIp, 4000).subscribe(() => {
      // Refresh list after adding
      this.service.getMachines().subscribe(data => this.machines = data as Machine[] || [] as Machine[]);
      this.newMachineName = '';
    });
  }

  selectMachine(m: Machine) {
    this.selectedMachine = m;

    // Call GraphQL for history
    this.service.getHistory(m.id).subscribe(logs => {
      // Format data for Chart.js
      this.lineChartData = {
        labels: logs.map(l => new Date(parseInt(l.timestamp)).toLocaleTimeString()),
        datasets: [{
          data: logs.map(l => l.cpu_load),
          label: 'CPU Load %',
          borderColor: '#007bff',
          backgroundColor: 'rgba(0,123,255,0.1)',
          fill: true,
          tension: 0.4 // Makes the line smooth/curved
        }]
      };
    });
  }
}
