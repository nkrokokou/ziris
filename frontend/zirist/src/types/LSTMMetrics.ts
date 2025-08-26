export interface LSTMMetrics {
  accuracy: number;
  mse: number;
  prediction: number[]; // [avg_temp, avg_press, avg_vib, avg_fumee]
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  precision: number; // 0..1
  recall: number;    // 0..1
  f1: number;        // 0..1
}
