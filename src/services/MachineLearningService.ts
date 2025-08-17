// Machine Learning Integration Service for Prediction System
import { Timestamp } from 'firebase/firestore';

// Types for ML features
interface PredictionOutcome {
  date: string;
  predictedWeight: number;
  actualWeight: number;
  accuracy: number;
  modelUsed: string;
  confidence: number;
}

interface ModelPerformance {
  modelId: string;
  accuracy: number;
  errorRate: number;
  confidenceScore: number;
  lastUpdated: Date;
  sampleSize: number;
}

interface NeuralNetworkWeights {
  hiddenLayer: number[][];
  outputLayer: number[];
  biases: number[];
}

interface EnsembleModel {
  patternModel: { weight: number; accuracy: number };
  clientModel: { weight: number; accuracy: number };
  trendModel: { weight: number; accuracy: number };
  neuralModel: { weight: number; accuracy: number };
}

export class MachineLearningService {
  private static instance: MachineLearningService;
  private predictionOutcomes: PredictionOutcome[] = [];
  private modelPerformances: Map<string, ModelPerformance> = new Map();
  private neuralNetworkWeights: NeuralNetworkWeights | null = null;
  private ensembleWeights: EnsembleModel = {
    patternModel: { weight: 0.4, accuracy: 0.75 },
    clientModel: { weight: 0.25, accuracy: 0.70 },
    trendModel: { weight: 0.2, accuracy: 0.65 },
    neuralModel: { weight: 0.15, accuracy: 0.60 }
  };

  private constructor() {
    this.initializeNeuralNetwork();
    this.loadStoredModelData();
  }

  public static getInstance(): MachineLearningService {
    if (!MachineLearningService.instance) {
      MachineLearningService.instance = new MachineLearningService();
    }
    return MachineLearningService.instance;
  }

  // 1. REAL-TIME MODEL RETRAINING
  public async recordPredictionOutcome(
    date: string,
    predictedWeight: number,
    actualWeight: number,
    modelUsed: string = 'ensemble'
  ): Promise<void> {
    console.log('🔄 Recording prediction outcome for model retraining...');

    const accuracy = this.calculateAccuracy(predictedWeight, actualWeight);
    const outcome: PredictionOutcome = {
      date,
      predictedWeight,
      actualWeight,
      accuracy,
      modelUsed,
      confidence: this.calculateOutcomeConfidence(predictedWeight, actualWeight)
    };

    this.predictionOutcomes.push(outcome);
    
    // Keep only last 100 outcomes for memory efficiency
    if (this.predictionOutcomes.length > 100) {
      this.predictionOutcomes = this.predictionOutcomes.slice(-100);
    }

    // Trigger retraining if we have enough new data
    if (this.predictionOutcomes.length >= 10) {
      await this.performIncrementalRetraining();
    }

    // Update model performance metrics
    await this.updateModelPerformance(modelUsed, accuracy);
    
    console.log(`✅ Recorded outcome: ${accuracy.toFixed(2)}% accuracy for ${modelUsed} model`);
  }

  private async performIncrementalRetraining(): Promise<void> {
    console.log('🧠 Performing incremental model retraining...');

    try {
      // Retrain ensemble weights based on recent performance
      await this.retrainEnsembleWeights();
      
      // Retrain neural network with new data
      await this.retrainNeuralNetwork();
      
      // Update model confidence scores
      this.updateModelConfidenceScores();
      
      // Save updated models
      this.saveModelData();
      
      console.log('✅ Incremental retraining completed');
    } catch (error) {
      console.error('❌ Error during model retraining:', error);
    }
  }

  private async retrainEnsembleWeights(): Promise<void> {
    // Calculate performance for each model type
    const modelPerformances = {
      patternModel: this.getModelAverageAccuracy('pattern'),
      clientModel: this.getModelAverageAccuracy('client'),
      trendModel: this.getModelAverageAccuracy('trend'),
      neuralModel: this.getModelAverageAccuracy('neural')
    };

    // Normalize weights based on performance (better models get higher weights)
    const totalPerformance = Object.values(modelPerformances).reduce((sum, perf) => sum + perf, 0);
    
    if (totalPerformance > 0) {
      this.ensembleWeights.patternModel.weight = modelPerformances.patternModel / totalPerformance;
      this.ensembleWeights.clientModel.weight = modelPerformances.clientModel / totalPerformance;
      this.ensembleWeights.trendModel.weight = modelPerformances.trendModel / totalPerformance;
      this.ensembleWeights.neuralModel.weight = modelPerformances.neuralModel / totalPerformance;

      // Update accuracy records
      this.ensembleWeights.patternModel.accuracy = modelPerformances.patternModel;
      this.ensembleWeights.clientModel.accuracy = modelPerformances.clientModel;
      this.ensembleWeights.trendModel.accuracy = modelPerformances.trendModel;
      this.ensembleWeights.neuralModel.accuracy = modelPerformances.neuralModel;
    }

    console.log('🎯 Updated ensemble weights:', this.ensembleWeights);
  }

  private getModelAverageAccuracy(modelType: string): number {
    const relevantOutcomes = this.predictionOutcomes
      .filter(outcome => outcome.modelUsed.includes(modelType))
      .slice(-20); // Use last 20 outcomes

    if (relevantOutcomes.length === 0) return 0.5; // Default accuracy

    return relevantOutcomes.reduce((sum, outcome) => sum + outcome.accuracy, 0) / relevantOutcomes.length;
  }

  // 2. NEURAL NETWORK CONFIDENCE SCORING
  private initializeNeuralNetwork(): void {
    // Simple neural network for confidence scoring
    // Input: [dayOfWeek, seasonalFactor, historicalVariance, modelAgreement, recencyFactor]
    // Hidden layer: 8 neurons
    // Output: confidence score (0-1)
    
    this.neuralNetworkWeights = {
      hiddenLayer: Array(8).fill(null).map(() => 
        Array(5).fill(null).map(() => (Math.random() - 0.5) * 2) // Random weights between -1 and 1
      ),
      outputLayer: Array(8).fill(null).map(() => (Math.random() - 0.5) * 2),
      biases: Array(8).fill(null).map(() => (Math.random() - 0.5) * 2)
    };
  }

  public calculateNeuralConfidence(
    dayOfWeek: number,
    seasonalFactor: number,
    historicalVariance: number,
    modelAgreement: number,
    recencyFactor: number = 1.0
  ): number {
    if (!this.neuralNetworkWeights) {
      this.initializeNeuralNetwork();
    }

    const inputs = [
      dayOfWeek / 6, // Normalize to 0-1
      (seasonalFactor - 0.5) * 2, // Normalize around 0
      Math.min(historicalVariance / 100, 1), // Cap at 1
      modelAgreement, // Already 0-1
      recencyFactor // Already 0-1
    ];

    // Forward propagation
    const hiddenOutputs = this.neuralNetworkWeights!.hiddenLayer.map((weights, i) => {
      const sum = weights.reduce((acc, weight, j) => acc + weight * inputs[j], 0) + this.neuralNetworkWeights!.biases[i];
      return this.sigmoid(sum);
    });

    const finalOutput = this.neuralNetworkWeights!.outputLayer.reduce((sum, weight, i) => 
      sum + weight * hiddenOutputs[i], 0
    );

    return Math.max(0.1, Math.min(1.0, this.sigmoid(finalOutput))); // Constrain between 0.1 and 1.0
  }

  private async retrainNeuralNetwork(): Promise<void> {
    if (this.predictionOutcomes.length < 10) return;

    console.log('🧠 Retraining neural network with recent outcomes...');

    // Simple gradient descent training
    const learningRate = 0.01;
    const epochs = 50;

    for (let epoch = 0; epoch < epochs; epoch++) {
      for (const outcome of this.predictionOutcomes.slice(-20)) {
        // Extract features from outcome
        const dayOfWeek = new Date(outcome.date).getDay();
        const seasonalFactor = this.getSeasonalFactor(new Date(outcome.date));
        const historicalVariance = Math.abs(outcome.predictedWeight - outcome.actualWeight);
        const modelAgreement = outcome.confidence;

        const inputs = [
          dayOfWeek / 6,
          (seasonalFactor - 0.5) * 2,
          Math.min(historicalVariance / 100, 1),
          modelAgreement,
          1.0
        ];

        const target = outcome.accuracy / 100; // Convert to 0-1 range

        // Simple backpropagation (simplified for demo)
        this.performBackpropagation(inputs, target, learningRate);
      }
    }

    console.log('✅ Neural network retraining completed');
  }

  private performBackpropagation(inputs: number[], target: number, learningRate: number): void {
    // Simplified backpropagation implementation
    // In a real implementation, this would be much more complex
    
    if (!this.neuralNetworkWeights) return;

    // Forward pass
    const hiddenOutputs = this.neuralNetworkWeights.hiddenLayer.map((weights, i) => {
      const sum = weights.reduce((acc, weight, j) => acc + weight * inputs[j], 0) + this.neuralNetworkWeights!.biases[i];
      return this.sigmoid(sum);
    });

    const output = this.neuralNetworkWeights.outputLayer.reduce((sum, weight, i) => 
      sum + weight * hiddenOutputs[i], 0
    );
    const finalOutput = this.sigmoid(output);

    // Calculate error
    const error = target - finalOutput;

    // Update weights (simplified)
    const outputError = error * this.sigmoidDerivative(finalOutput);
    
    // Update output layer weights
    for (let i = 0; i < this.neuralNetworkWeights.outputLayer.length; i++) {
      this.neuralNetworkWeights.outputLayer[i] += learningRate * outputError * hiddenOutputs[i];
    }

    // Update hidden layer weights (simplified)
    for (let i = 0; i < this.neuralNetworkWeights.hiddenLayer.length; i++) {
      const hiddenError = outputError * this.neuralNetworkWeights.outputLayer[i] * this.sigmoidDerivative(hiddenOutputs[i]);
      for (let j = 0; j < this.neuralNetworkWeights.hiddenLayer[i].length; j++) {
        this.neuralNetworkWeights.hiddenLayer[i][j] += learningRate * hiddenError * inputs[j];
      }
      this.neuralNetworkWeights.biases[i] += learningRate * hiddenError;
    }
  }

  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  private sigmoidDerivative(x: number): number {
    return x * (1 - x);
  }

  // 3. ENSEMBLE MODEL AVERAGING
  public calculateEnsemblePrediction(
    patternPrediction: number,
    clientPrediction: number,
    trendPrediction: number,
    neuralPrediction: number
  ): { prediction: number; confidence: number; modelContributions: any } {
    const weights = this.ensembleWeights;
    
    // Weighted average of predictions
    const ensemblePrediction = 
      patternPrediction * weights.patternModel.weight +
      clientPrediction * weights.clientModel.weight +
      trendPrediction * weights.trendModel.weight +
      neuralPrediction * weights.neuralModel.weight;

    // Calculate ensemble confidence based on model agreement and individual confidences
    const predictions = [patternPrediction, clientPrediction, trendPrediction, neuralPrediction];
    const mean = predictions.reduce((sum, pred) => sum + pred, 0) / predictions.length;
    const variance = predictions.reduce((sum, pred) => sum + Math.pow(pred - mean, 2), 0) / predictions.length;
    
    // Lower variance means higher agreement, higher confidence
    const agreementScore = Math.max(0, 1 - (Math.sqrt(variance) / Math.max(mean, 1)));
    
    // Weight agreement by model accuracies
    const weightedAccuracy = 
      weights.patternModel.accuracy * weights.patternModel.weight +
      weights.clientModel.accuracy * weights.clientModel.weight +
      weights.trendModel.accuracy * weights.trendModel.weight +
      weights.neuralModel.accuracy * weights.neuralModel.weight;

    const ensembleConfidence = (agreementScore * 0.6 + weightedAccuracy * 0.4);

    return {
      prediction: Math.round(ensemblePrediction),
      confidence: Math.max(0.1, Math.min(1.0, ensembleConfidence)),
      modelContributions: {
        pattern: { value: patternPrediction, weight: weights.patternModel.weight, accuracy: weights.patternModel.accuracy },
        client: { value: clientPrediction, weight: weights.clientModel.weight, accuracy: weights.clientModel.accuracy },
        trend: { value: trendPrediction, weight: weights.trendModel.weight, accuracy: weights.trendModel.accuracy },
        neural: { value: neuralPrediction, weight: weights.neuralModel.weight, accuracy: weights.neuralModel.accuracy }
      }
    };
  }

  public getEnsembleWeights(): EnsembleModel {
    return { ...this.ensembleWeights };
  }

  public getModelPerformanceMetrics(): Map<string, ModelPerformance> {
    return new Map(this.modelPerformances);
  }

  // HELPER METHODS
  private calculateAccuracy(predicted: number, actual: number): number {
    if (actual === 0) return predicted === 0 ? 100 : 0;
    const error = Math.abs(predicted - actual) / actual;
    return Math.max(0, (1 - error) * 100);
  }

  private calculateOutcomeConfidence(predicted: number, actual: number): number {
    const accuracy = this.calculateAccuracy(predicted, actual);
    return accuracy / 100;
  }

  private async updateModelPerformance(modelId: string, accuracy: number): Promise<void> {
    const existing = this.modelPerformances.get(modelId);
    
    if (existing) {
      // Update running average
      const newSampleSize = existing.sampleSize + 1;
      const newAccuracy = (existing.accuracy * existing.sampleSize + accuracy) / newSampleSize;
      
      this.modelPerformances.set(modelId, {
        ...existing,
        accuracy: newAccuracy,
        errorRate: 100 - newAccuracy,
        sampleSize: newSampleSize,
        lastUpdated: new Date()
      });
    } else {
      this.modelPerformances.set(modelId, {
        modelId,
        accuracy,
        errorRate: 100 - accuracy,
        confidenceScore: accuracy / 100,
        lastUpdated: new Date(),
        sampleSize: 1
      });
    }
  }

  private updateModelConfidenceScores(): void {
    // Update confidence scores based on recent performance
    for (const [modelId, performance] of this.modelPerformances) {
      const confidenceScore = Math.min(1.0, performance.accuracy / 100);
      this.modelPerformances.set(modelId, {
        ...performance,
        confidenceScore
      });
    }
  }

  private getSeasonalFactor(date: Date): number {
    const month = date.getMonth();
    const seasonalFactors: { [key: number]: number } = {
      0: 1.1, 1: 0.95, 2: 1.05, 3: 1.1, 4: 1.15, 5: 1.2,
      6: 1.1, 7: 1.05, 8: 1.1, 9: 1.0, 10: 0.9, 11: 1.05
    };
    return seasonalFactors[month] || 1.0;
  }

  private loadStoredModelData(): void {
    try {
      const stored = localStorage.getItem('ml_model_data');
      if (stored) {
        const data = JSON.parse(stored);
        if (data.ensembleWeights) {
          this.ensembleWeights = data.ensembleWeights;
        }
        if (data.neuralWeights) {
          this.neuralNetworkWeights = data.neuralWeights;
        }
        if (data.modelPerformances) {
          this.modelPerformances = new Map(data.modelPerformances);
        }
        console.log('✅ Loaded stored ML model data');
      }
    } catch (error) {
      console.warn('⚠️ Could not load stored ML model data:', error);
    }
  }

  private saveModelData(): void {
    try {
      const data = {
        ensembleWeights: this.ensembleWeights,
        neuralWeights: this.neuralNetworkWeights,
        modelPerformances: Array.from(this.modelPerformances.entries()),
        lastSaved: new Date().toISOString()
      };
      localStorage.setItem('ml_model_data', JSON.stringify(data));
      console.log('💾 Saved ML model data to localStorage');
    } catch (error) {
      console.warn('⚠️ Could not save ML model data:', error);
    }
  }

  // PUBLIC API FOR GETTING ML INSIGHTS
  public getMLInsights(): any {
    const recentAccuracy = this.predictionOutcomes.length > 0 
      ? this.predictionOutcomes.slice(-10).reduce((sum, outcome) => sum + outcome.accuracy, 0) / Math.min(10, this.predictionOutcomes.length)
      : 0;

    const totalPredictions = this.predictionOutcomes.length;
    const modelPerformanceSummary = Array.from(this.modelPerformances.entries()).map(([modelId, performance]) => ({
      model: modelId,
      accuracy: performance.accuracy.toFixed(1) + '%',
      samples: performance.sampleSize,
      lastUpdated: performance.lastUpdated.toLocaleDateString()
    }));

    return {
      recentAccuracy: recentAccuracy.toFixed(1) + '%',
      totalPredictions,
      ensembleWeights: this.ensembleWeights,
      modelPerformances: modelPerformanceSummary,
      neuralNetworkActive: this.neuralNetworkWeights !== null,
      lastRetraining: totalPredictions >= 10 ? 'Recent' : 'Pending'
    };
  }

  // Get outcome for a specific date (for outcome recorder)
  public getOutcomeForDate(date: string): PredictionOutcome | null {
    return this.predictionOutcomes.find(outcome => outcome.date === date) || null;
  }
}

export default MachineLearningService;
