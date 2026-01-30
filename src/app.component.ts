
import { Component, signal, inject, OnInit, ChangeDetectionStrategy, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouteOptimizerService, Order, LocationPoint } from './services/route-optimizer.service';
import { MapVisualizerComponent } from './components/map-visualizer.component';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MapVisualizerComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  private optimizerService = inject(RouteOptimizerService);

  orders = signal<Order[]>([]);
  isOptimizing = signal<boolean>(false);
  lastOptimizationTime = signal<Date | null>(null);
  
  // Selection State
  selectedOrder = signal<Order | null>(null);

  // Mobile UI State
  isPanelExpanded = signal<boolean>(false);
  
  // Navigation Simulation State
  isNavigating = signal<boolean>(false);
  driverPosition = signal<LocationPoint | null>(null);
  navDistanceRemaining = signal<number>(0);
  private simulationInterval: any = null;
  
  // Stats
  totalPotentialProfit = signal<number>(0);
  totalDistance = signal<number>(0);

  ngOnInit() {
    this.refreshOrders();
  }

  ngOnDestroy() {
    this.stopNavigation();
  }

  togglePanel() {
    this.isPanelExpanded.update(v => !v);
  }

  closePanel() {
    if (!this.isNavigating()) {
      this.isPanelExpanded.set(false);
    }
  }

  selectOrder(order: Order) {
    if (this.isNavigating()) return; // Lock selection during nav
    this.selectedOrder.set(order);
    this.isPanelExpanded.set(true); 
  }

  clearSelection() {
    if (this.isNavigating()) return;
    this.selectedOrder.set(null);
  }

  refreshOrders() {
    this.stopNavigation(); // Ensure we stop nav if refreshing
    this.clearSelection();
    const newOrders = this.optimizerService.generateMockOrders(5); 
    this.orders.set(newOrders);
    this.calculateStats(newOrders);
    this.lastOptimizationTime.set(null);
    this.isPanelExpanded.set(false);
  }

  async optimizeRoutes() {
    if (this.isOptimizing() || this.isNavigating()) return;

    this.isOptimizing.set(true);
    this.clearSelection();
    
    const currentOrders = this.orders();
    
    try {
      const optimized = await this.optimizerService.optimizeRouteBatch(currentOrders);
      this.orders.set(optimized);
      this.calculateStats(optimized);
      this.lastOptimizationTime.set(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      this.isOptimizing.set(false);
    }
  }

  calculateStats(data: Order[]) {
    const totalP = data.reduce((acc, curr) => acc + curr.price, 0);
    const totalD = data.reduce((acc, curr) => acc + curr.distanceKm, 0);
    this.totalPotentialProfit.set(totalP);
    this.totalDistance.set(totalD);
  }

  // --- NAVIGATION SIMULATION LOGIC ---

  startNavigation() {
    const order = this.selectedOrder();
    if (!order) return;

    this.isNavigating.set(true);
    this.isPanelExpanded.set(false); // Collapse standard panel
    
    // Initialize at Pickup
    let progress = 0;
    const start = order.pickup;
    const end = order.dropoff;
    
    this.driverPosition.set({ ...start });
    this.navDistanceRemaining.set(order.distanceKm);

    // Simulation Loop (Linear Interpolation)
    if (this.simulationInterval) clearInterval(this.simulationInterval);
    
    const durationMs = 15000; // 15 seconds to complete route
    const stepMs = 50;
    const steps = durationMs / stepMs;
    const increment = 1 / steps;

    this.simulationInterval = setInterval(() => {
      progress += increment;

      if (progress >= 1) {
        // Arrived
        this.driverPosition.set({ ...end });
        this.navDistanceRemaining.set(0);
        this.stopNavigation();
        alert(`Entrega finalizada! Você ganhou R$ ${order.price.toFixed(2)}`);
        this.refreshOrders(); // Get new orders
        return;
      }

      // Lerp X and Y
      const currentX = start.x + (end.x - start.x) * progress;
      const currentY = start.y + (end.y - start.y) * progress;

      this.driverPosition.set({ x: currentX, y: currentY, label: 'Driver' });
      this.navDistanceRemaining.set(order.distanceKm * (1 - progress));

    }, stepMs);
  }

  stopNavigation() {
    this.isNavigating.set(false);
    this.driverPosition.set(null);
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
    // Re-open panel if we still have an order selected (user cancelled)
    if (this.selectedOrder()) {
      this.isPanelExpanded.set(true);
    }
  }
}
