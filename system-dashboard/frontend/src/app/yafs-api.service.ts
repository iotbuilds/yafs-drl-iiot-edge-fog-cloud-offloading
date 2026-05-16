import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, forkJoin, interval, map, of, startWith, switchMap } from 'rxjs';
import { environment } from '../environments/environment';

export interface Snapshot {
  health: any;
  kpis: any;
  events: any[];
  decisions: any[];
  nodes: any[];
  cloudRecords: any[];
  topology: any;
}

@Injectable({ providedIn: 'root' })
export class YafsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  readonly snapshot = signal<Snapshot | null>(null);
  readonly active = computed(() => this.snapshot()?.health?.status === 'ok');

  startPolling() {
    return interval(5000).pipe(
      startWith(0),
      switchMap(() => this.loadSnapshot())
    ).subscribe(snapshot => this.snapshot.set(snapshot));
  }

  private loadSnapshot() {
    return forkJoin({
      health: this.get('/api/health', { status: 'inactive' }),
      kpis: this.get('/api/kpis', {}),
      eventsPayload: this.get('/api/events?limit=10000', { items: [] }),
      decisionsPayload: this.get('/api/decisions?limit=10000', { items: [] }),
      nodesPayload: this.get('/api/nodes?limit=2000', { items: [] }),
      cloudPayload: this.get('/api/cloud-records?limit=10000', { items: [] }),
      topology: this.get('/api/topology', {})
    }).pipe(map(result => ({
      health: result.health,
      kpis: result.kpis,
      events: result.eventsPayload.items ?? result.eventsPayload ?? [],
      decisions: result.decisionsPayload.items ?? result.decisionsPayload ?? [],
      nodes: result.nodesPayload.items ?? result.nodesPayload ?? [],
      cloudRecords: result.cloudPayload.items ?? result.cloudPayload ?? [],
      topology: result.topology
    })));
  }

  private get(path: string, fallback: any) {
    return this.http.get<any>(`${this.baseUrl}${path}`).pipe(catchError(() => of(fallback)));
  }
}
