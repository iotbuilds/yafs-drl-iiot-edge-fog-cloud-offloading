# Performance Results Figures

This folder contains the report-ready figures for the Results / Performance Evaluation section.

## Recommended placement order

1. `01_drl_vs_baselines_latency.png`  
   Place after the overall DRL vs baseline comparison table.

2. `02_deadline_success_rate.png`  
   Place after the latency comparison figure.

3. `03_network_congestion.png`  
   Place after the deadline success figure.

4. `06_energy_cost.png`  
   Place after the congestion figure.

5. `07_throughput.png`  
   Place after the energy figure if space allows.

6. `08_fairness_load_balancing.png`  
   Place after the throughput figure if space allows.

7. `04_offloading_path_distribution.png`  
   Place after the DRL offloading path distribution table.

8. `09_drl_path_distribution.png`  
   Place after the stacked offloading path distribution figure.

9. `05_cloud_escalation_ratio.png`  
   Place after the layer processing or offloading behavior table.

10. `11_drl_reward_convergence.png`  
    Place after the DRL behavior table.

11. `12_exploration_vs_exploitation.png`  
    Place after the DRL reward convergence figure.

12. `10_cloud_transmission_records.png`  
    Place after the three-level cloud policy records table.

## LaTeX helper

Use `performance_results_figure_placements.tex` for ready-made LaTeX figure blocks, captions, labels, and placement comments.

Copy this folder into your LaTeX report as:

```text
Figures/performance_results
```

Then the paths in the LaTeX helper will work without changes.

