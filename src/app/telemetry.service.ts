import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Apollo, gql } from 'apollo-angular';
import io, { Socket } from 'socket.io-client';
import { Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';

// --- Interfaces to keep types safe ---
export interface Machine {
  id: string; // GraphQL uses 'id', MongoDB uses '_id'
  name: string;
  ip: string;
  currentCpu?: number; // Optional, added by Socket.IO later
}

export interface Log {
  cpu_load: number;
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class TelemetryService {
  private socket: any;

  // A "Subject" is like an Event Emitter for Angular components
  private realtimeUpdateSubject = new Subject<{ machineId: string, cpu: number }>();

  constructor(private http: HttpClient, private apollo: Apollo) {
    // 1. Connect Socket.IO
    this.socket = io('http://localhost:3000');

    // 2. Listen for incoming C++ data
    this.socket.on('telemetry_update', (data: { machineId: string, cpu: number }) => {
      this.realtimeUpdateSubject.next(data);
    });
  }

  // --- A. SOCKET: Expose the stream ---
  getRealtimeUpdates(): Observable<{ machineId: string, cpu: number }> {
    return this.realtimeUpdateSubject.asObservable();
  }

  // --- B. REST: Add a new Machine ---
  addMachine(name: string, ip: string, port: number) {
    return this.http.post<Machine>('http://localhost:3000/api/machines', { name, ip, port });
  }

  // --- C. GRAPHQL: Get Machines & History ---

  // Query 1: Get list of all machines
  getMachines() {
    return this.apollo.watchQuery<{ machines: Machine[] }>({
      query: gql`
        query GetMachines {
          machines {
            id
            name
            ip
          }
        }
      `
    }).valueChanges.pipe(map(result => result.data ? result.data.machines : [{ id: "", name: "", ip: "", currentCpu: 0 }] as Machine[]));
  }

  // Query 2: Get history for one machine
  getHistory(machineId: string) {
    return this.apollo.query<{ history: Log[] }>({
      query: gql`
        query GetHistory($mid: ID!) {
          history(machineId: $mid) {
            cpu_load
            timestamp
          }
        }
      `,
      variables: { mid: machineId },
      fetchPolicy: 'network-only' // Don't use cache, get fresh data
    }).pipe(map(result => result.data ? result.data.history : [{ cpu_load: 0, timestamp: "" }] as Log[]));
  }
}
