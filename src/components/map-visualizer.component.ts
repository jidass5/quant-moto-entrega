
import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Order, LocationPoint } from '../services/route-optimizer.service';

@Component({
  selector: 'app-map-visualizer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    .route-flow {
      stroke-dasharray: 2;
      animation: dash-flow 1s linear infinite;
      z-index: 20;
    }

    .marker-pulse {
      animation: pulse-scale 1.5s ease-in-out infinite;
      transform-origin: center;
      transform-box: fill-box;
    }

    .driver-pulse {
      animation: radio-waves 1.5s infinite;
      transform-origin: center;
      transform-box: fill-box;
    }
    
    .scan-line {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 20%;
      background: linear-gradient(to bottom, transparent, rgba(56, 189, 248, 0.15), transparent);
      animation: scan 4s linear infinite;
      pointer-events: none;
      z-index: 5;
    }

    @keyframes scan {
      0% { transform: translateY(-120%); }
      100% { transform: translateY(600%); }
    }

    @keyframes dash-flow {
      from { stroke-dashoffset: 4; }
      to { stroke-dashoffset: 0; }
    }

    @keyframes pulse-scale {
      0% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.5); opacity: 0.8; }
      100% { transform: scale(1); opacity: 1; }
    }

    @keyframes radio-waves {
      0% { opacity: 0.8; transform: scale(1); border-width: 1px; }
      100% { opacity: 0; transform: scale(4); border-width: 0px; }
    }
    
    .map-transition {
      transition: all 1.2s cubic-bezier(0.25, 0.8, 0.25, 1);
    }
  `],
  template: `
    <div class="relative w-full h-full bg-[#020617] overflow-hidden">
      
      <!-- Satellite Scan Effect Overlay -->
      <div class="scan-line"></div>
      
      <!-- Vignette -->
      <div class="absolute inset-0 pointer-events-none z-10 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)]"></div>

      <!-- Simulated Satellite Map -->
      <svg class="w-full h-full map-transition" preserveAspectRatio="xMidYMid slice" 
           [attr.viewBox]="currentViewBox()">
        <defs>
          <!-- 1. Terrain Texture (Noise) -->
          <filter id="terrain-noise" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="1.5" numOctaves="4" stitchTiles="stitch"/>
            <feColorMatrix type="saturate" values="0"/>
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.15"/> 
            </feComponentTransfer>
            <feComposite operator="in" in2="SourceGraphic"/>
          </filter>

          <!-- 2. Water Texture -->
          <pattern id="water-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
             <path d="M0 10 Q 5 5 10 10 T 20 10" fill="none" stroke="#0ea5e9" stroke-opacity="0.05" stroke-width="0.5"/>
          </pattern>
          
          <!-- 3. Land Shadow (Depth) -->
          <filter id="land-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="0.5"/>
            <feOffset dx="0" dy="0" result="offsetblur"/>
            <feFlood flood-color="#4ade80" flood-opacity="0.1"/> <!-- Slight green atmospheric glow -->
            <feComposite in2="offsetblur" operator="in"/>
            <feMerge>
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          <!-- 4. Neon Route Glow -->
          <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        <!-- --- SATELLITE BASE LAYERS --- -->
        
        <!-- Ocean (Dark Deep Blue) -->
        <rect width="100%" height="100%" fill="#020617"/> 
        <rect width="100%" height="100%" fill="url(#water-pattern)" />

        <!-- Land Mass (Dark Green/Grey with Texture) -->
        <g filter="url(#land-glow)">
           <!-- Main Land shape -->
           <path d="M -10,-10 L 85,-10 Q 80,20 85,40 T 90,70 T 80,100 L -10,100 Z" fill="#0f172a" />
           
           <!-- Overlay Texture on Land -->
           <path d="M -10,-10 L 85,-10 Q 80,20 85,40 T 90,70 T 80,100 L -10,100 Z" fill="#14532d" opacity="0.3" filter="url(#terrain-noise)" />
        </g>
        
        <!-- Urban Density Areas (Lighter patches imitating city lights/concrete) -->
        <circle cx="65" cy="40" r="15" fill="#334155" opacity="0.4" filter="url(#terrain-noise)" /> <!-- Kobrasol -->
        <circle cx="40" cy="50" r="18" fill="#334155" opacity="0.3" filter="url(#terrain-noise)" /> <!-- Barreiros -->

        <!-- --- ROADS (Satellite Hybrid Style) --- -->
        <!-- Main Highway (Bright Yellow/White glow) -->
        <path d="M 55,-10 Q 58,30 60,50 T 65,110" stroke="#fbbf24" stroke-width="2.5" fill="none" opacity="0.1" /> <!-- Glow -->
        <path d="M 55,-10 Q 58,30 60,50 T 65,110" stroke="#e2e8f0" stroke-width="1" fill="none" opacity="0.9" /> <!-- Road -->
        
        <!-- Via Expressa -->
        <path d="M -10,45 Q 40,48 100,42" stroke="#fbbf24" stroke-width="2" fill="none" opacity="0.1" />
        <path d="M -10,45 Q 40,48 100,42" stroke="#e2e8f0" stroke-width="0.8" fill="none" opacity="0.8" />

        <!-- Secondary Roads (Faint Grey) -->
        <path d="M 60,40 Q 80,45 80,80" stroke="#64748b" stroke-width="0.4" fill="none" />
        <path d="M 30,20 Q 40,40 40,60" stroke="#64748b" stroke-width="0.4" fill="none" />
        
        <!-- Street Grid (Simulated) -->
        <path d="M 50,20 L 70,25 M 55,30 L 75,35 M 40,60 L 20,65" stroke="#475569" stroke-width="0.2" opacity="0.5" />

        <!-- --- LABELS (Satellite Style) --- -->
        @if (!isNavigating()) {
          <text x="88" y="50" font-size="2" fill="#38bdf8" font-weight="600" letter-spacing="0.2" opacity="0.6" transform="rotate(90 88,50)">BAÍA NORTE</text>
          <text x="52" y="5" font-size="1.2" fill="#cbd5e1" font-weight="bold" opacity="0.8">BR-101</text>
          <text x="60" y="38" font-size="1" fill="#cbd5e1" font-weight="bold" opacity="0.7">KOBRASOL</text>
          <text x="70" y="45" font-size="1" fill="#94a3b8" opacity="0.6">CAMPINAS</text>
        }

        <!-- --- ACTIVE ROUTES --- -->
        @for (order of orders(); track order.id; let i = $index) {
          
          <g [attr.opacity]="getOpacity(order.id)" class="transition-opacity duration-500">
            
            <!-- Inactive/Background Route Path -->
            <line 
              [attr.x1]="order.pickup.x" 
              [attr.y1]="order.pickup.y" 
              [attr.x2]="order.dropoff.x" 
              [attr.y2]="order.dropoff.y" 
              stroke="#000000"
              [attr.stroke-width]="getStrokeWidth(order.id) + 0.5"
              stroke-linecap="round"
              opacity="0.5"
            />

            <!-- Active Traffic Route -->
            <line 
              [attr.x1]="order.pickup.x" 
              [attr.y1]="order.pickup.y" 
              [attr.x2]="order.dropoff.x" 
              [attr.y2]="order.dropoff.y" 
              [attr.stroke]="getTrafficColor(order.trafficLevel)"
              [attr.stroke-width]="getStrokeWidth(order.id)"
              stroke-linecap="round"
              class="transition-all duration-300"
              [class.route-flow]="isBestRoute(order.id) || isNavigating()"
              [attr.filter]="isBestRoute(order.id) ? 'url(#neon-glow)' : ''"
            />
            
            <!-- Pickup Marker (Neon Square) -->
            <g [attr.transform]="'translate(' + order.pickup.x + ',' + order.pickup.y + ')'">
               <rect x="-1.5" y="-1.5" width="3" height="3" 
                     fill="#000" [attr.stroke]="isBestRoute(order.id) ? '#fff' : '#94a3b8'" stroke-width="0.5" rx="0.5"
                     [class.marker-pulse]="isBestRoute(order.id)" />
               <!-- Inner dot -->
               <rect x="-0.5" y="-0.5" width="1" height="1" fill="#fff" />
            </g>

            <!-- Dropoff Marker (Neon Circle) -->
            <g [attr.transform]="'translate(' + order.dropoff.x + ',' + order.dropoff.y + ')'">
              <circle r="1.5" 
                      fill="#000" [attr.stroke]="isBestRoute(order.id) ? '#fff' : '#94a3b8'" stroke-width="0.5"
                      [class.marker-pulse]="isBestRoute(order.id)" />
               <circle r="0.5" fill="#fff" />
            </g>

          </g>
        }

        <!-- --- DRIVER NAVIGATION MARKER (ACTIVE) --- -->
        @if (isNavigating() && driverPosition()) {
          <g [attr.transform]="'translate(' + driverPosition()!.x + ',' + driverPosition()!.y + ')'" filter="url(#neon-glow)">
            <!-- Pulse ring -->
            <circle r="8" fill="none" stroke="#38bdf8" stroke-width="0.2" class="driver-pulse" />
            <circle r="4" fill="#0ea5e9" opacity="0.4" class="driver-pulse" />
            
            <!-- Bike Icon / Triangle -->
             <path d="M 0,-3 L 2,3 L 0,2 L -2,3 Z" fill="#00ffff" stroke="white" stroke-width="0.5" />
          </g>
        } @else if (!isNavigating()) {
           <!-- Idle Driver -->
           <g transform="translate(60, 50)">
             <circle r="4" fill="#38bdf8" opacity="0.2" class="driver-pulse" />
             <circle r="1.5" fill="#0ea5e9" stroke="white" stroke-width="0.5" />
           </g>
        }

      </svg>
    </div>
  `
})
export class MapVisualizerComponent {
  orders = input.required<Order[]>();
  selectedOrderId = input<string | null>(null);
  
  // Navigation State
  isNavigating = input<boolean>(false);
  driverPosition = input<LocationPoint | null>(null);

  // Compute ViewBox: Zoom in when navigating
  currentViewBox = computed(() => {
    if (this.isNavigating() && this.driverPosition()) {
      const pos = this.driverPosition()!;
      // Tighter zoom for satellite view
      const width = 20;
      const height = 20;
      const minX = pos.x - (width / 2);
      const minY = pos.y - (height / 2);
      return `${minX} ${minY} ${width} ${height}`;
    }
    return "0 0 100 100";
  });

  bestOrderId = computed(() => {
    const currentOrders = this.orders();
    if (!currentOrders || currentOrders.length === 0) return null;
    return currentOrders.reduce((prev, current) => 
      ((prev.profitabilityScore || 0) > (current.profitabilityScore || 0)) ? prev : current
    ).id;
  });

  isBestRoute(orderId: string): boolean {
    return this.bestOrderId() === orderId || this.selectedOrderId() === orderId;
  }

  getTrafficColor(level: string | undefined): string {
    // Neon colors for dark mode
    switch (level) {
      case 'Critical': return '#ff0055'; // Neon Red
      case 'High': return '#ff5e00'; // Neon Orange
      case 'Medium': return '#ffea00'; // Neon Yellow
      case 'Low': 
      default: return '#00ff9d'; // Neon Green
    }
  }

  getOpacity(orderId: string): number {
    const selected = this.selectedOrderId();
    
    if (this.isNavigating()) {
       return selected === orderId ? 1 : 0.02; // Very dim others during nav
    }

    if (selected) {
      return selected === orderId ? 1 : 0.1;
    }
    
    if (this.bestOrderId() && this.orders().some(o => o.profitabilityScore)) {
        return this.bestOrderId() === orderId ? 1 : 0.3;
    }
    return 0.7;
  }

  getStrokeWidth(orderId: string): number {
    const selected = this.selectedOrderId();
    if (this.isNavigating() && selected === orderId) return 1; // Thinner for zoom
    if (selected === orderId) return 1.5;
    if (this.bestOrderId() === orderId) return 1.2;
    return 0.6;
  }
}
