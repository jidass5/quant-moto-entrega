
import { Injectable } from '@angular/core';
import { GoogleGenAI, Type } from '@google/genai';

export interface LocationPoint {
  x: number;
  y: number;
  label: string;
}

export interface Order {
  id: string;
  restaurant: string;
  customer: string;
  price: number;
  distanceKm: number;
  estimatedTimeMin: number; // Final time including traffic
  baseTimeMin: number; // Time without traffic
  pickup: LocationPoint;
  dropoff: LocationPoint;
  priority: 'High' | 'Medium' | 'Low';
  profitabilityScore?: number; // Calculated by AI
  trafficLevel?: 'Low' | 'Medium' | 'High' | 'Critical';
  trafficDelayMin?: number;
}

// Bairros de São José - SC com coordenadas aproximadas (0-100)
// Litoral à direita (x > 80), BR-101 cortando em X=60
const NEIGHBORHOODS = {
  'Barreiros': { xMin: 40, xMax: 65, yMin: 5, yMax: 25 },
  'Bela Vista': { xMin: 30, xMax: 50, yMin: 20, yMax: 40 },
  'Kobrasol': { xMin: 55, xMax: 70, yMin: 30, yMax: 45 },
  'Campinas': { xMin: 65, xMax: 78, yMin: 35, yMax: 50 },
  'Praia Comprida': { xMin: 65, xMax: 80, yMin: 50, yMax: 65 },
  'Centro Histórico': { xMin: 70, xMax: 85, yMin: 65, yMax: 85 },
  'Ponta de Baixo': { xMin: 75, xMax: 90, yMin: 75, yMax: 90 },
  'Forquilhinhas': { xMin: 10, xMax: 40, yMin: 40, yMax: 60 },
  'Areias': { xMin: 30, xMax: 50, yMin: 40, yMax: 60 },
  'Serraria': { xMin: 40, xMax: 60, yMin: 0, yMax: 15 },
  'Fazenda Santo Antônio': { xMin: 20, xMax: 40, yMin: 60, yMax: 80 }
};

@Injectable({
  providedIn: 'root'
})
export class RouteOptimizerService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  private getRandomPointInNeighborhood(name: keyof typeof NEIGHBORHOODS): LocationPoint {
    const bounds = NEIGHBORHOODS[name];
    return {
      x: Math.random() * (bounds.xMax - bounds.xMin) + bounds.xMin,
      y: Math.random() * (bounds.yMax - bounds.yMin) + bounds.yMin,
      label: name
    };
  }

  // Generates dummy orders
  generateMockOrders(count: number): Order[] {
    const orders: Order[] = [];
    const restaurantNames = [
      'Sushi Kobrasol', 'Barreiros Burger', 'Pizzaria Campinas', 'Tacos da Praia', 'Marmitas da Dona Maria', 
      'Hot Dog do Zé', 'Açaí Floripa', 'Churrascaria BR', 'Pastelaria Areias', 'Bistrô Histórico'
    ];
    
    const neighborhoodKeys = Object.keys(NEIGHBORHOODS) as Array<keyof typeof NEIGHBORHOODS>;

    for (let i = 0; i < count; i++) {
      // Pick random neighborhoods for pickup and dropoff
      const pickupNeighborhood = neighborhoodKeys[Math.floor(Math.random() * neighborhoodKeys.length)];
      let dropoffNeighborhood = neighborhoodKeys[Math.floor(Math.random() * neighborhoodKeys.length)];
      
      // Ensure distinct locations occasionally for better routes
      while(pickupNeighborhood === dropoffNeighborhood && Math.random() > 0.5) {
        dropoffNeighborhood = neighborhoodKeys[Math.floor(Math.random() * neighborhoodKeys.length)];
      }

      const pickup = this.getRandomPointInNeighborhood(pickupNeighborhood);
      const dropoff = this.getRandomPointInNeighborhood(dropoffNeighborhood);

      // Calculate pseudo-distance based on coordinates (Euclidean distance on the grid)
      // Scale factor: assume map is approx 15km wide
      const dx = pickup.x - dropoff.x;
      const dy = pickup.y - dropoff.y;
      const distUnit = Math.sqrt(dx*dx + dy*dy);
      const realDistKm = Number((distUnit * 0.15).toFixed(1)); // Approx scale
      const baseTime = Math.floor(realDistKm * 2) + 5; // Optimistic base time

      orders.push({
        id: `SJ-${1000 + i}`,
        restaurant: restaurantNames[Math.floor(Math.random() * restaurantNames.length)] + ` (${pickupNeighborhood})`,
        customer: `Cliente em ${dropoffNeighborhood}`,
        price: Math.floor(Math.random() * 20) + 8 + (realDistKm * 1.5),
        distanceKm: realDistKm,
        estimatedTimeMin: baseTime,
        baseTimeMin: baseTime,
        pickup: pickup,
        dropoff: dropoff,
        priority: 'Medium'
      });
    }
    return orders;
  }

  async optimizeRouteBatch(orders: Order[]): Promise<Order[]> {
    const now = new Date();
    const timeString = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    const prompt = `
      Você é um sistema de monitoramento de tráfego em tempo real para São José, Santa Catarina.
      Hora Atual: ${timeString}.
      
      Regras de Trânsito Simuladas:
      1. BR-101 é MUITO lenta entre 17:00 e 19:30 (Sentido Norte/Sul).
      2. Via Expressa é travada em horário de pico.
      3. Bairros internos (Kobrasol/Campinas) têm trânsito médio.
      
      Para cada pedido, analise a rota (Origem -> Destino) e retorne:
      - trafficLevel: "Low", "Medium", "High", ou "Critical".
      - trafficDelayMin: Minutos extras a adicionar devido ao trânsito.
      - profitabilityScore: 0-100. (Se trânsito for Critical, score DEVE ser baixo, pois o motoboy perde tempo).
      
      Pedidos: ${JSON.stringify(orders.map(o => ({
        id: o.id,
        from: o.pickup.label,
        to: o.dropoff.label,
        price: o.price,
        baseTime: o.baseTimeMin
      })))}
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                profitabilityScore: { type: Type.NUMBER },
                trafficLevel: { type: Type.STRING, enum: ['Low', 'Medium', 'High', 'Critical'] },
                trafficDelayMin: { type: Type.INTEGER }
              }
            }
          }
        }
      });

      let jsonString = response.text || '[]';
      // Robust JSON extraction
      const firstBracket = jsonString.indexOf('[');
      const lastBracket = jsonString.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket !== -1) {
        jsonString = jsonString.substring(firstBracket, lastBracket + 1);
      } else {
        jsonString = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
      }
      
      const optimizedData = JSON.parse(jsonString);
      
      const optimizedOrders: Order[] = orders.map(order => {
        const analysis = optimizedData.find((d: any) => d.id === order.id);
        
        const delay = analysis ? Number(analysis.trafficDelayMin) : 0;
        const finalTime = order.baseTimeMin + delay;
        const trafficLevel = analysis ? analysis.trafficLevel : 'Low';
        const score = analysis ? Number(analysis.profitabilityScore) : 50;

        return {
          ...order,
          profitabilityScore: score,
          trafficLevel: trafficLevel,
          trafficDelayMin: delay,
          estimatedTimeMin: finalTime,
          priority: score > 80 ? 'High' : 'Medium'
        };
      });

      return optimizedOrders.sort((a, b) => (b.profitabilityScore || 0) - (a.profitabilityScore || 0));

    } catch (error) {
      console.error('Traffic Analysis failed', error);
      return orders;
    }
  }
}
