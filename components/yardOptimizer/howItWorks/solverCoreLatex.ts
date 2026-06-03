export const LATEX_COMPONENT_Q_SINGLE_SPOT = String.raw`
\begin{aligned}
Q(\pi)
  &= \operatorname{clip}\!\left(
       \frac{\pi}{s-\pi(s-1)},0,1
     \right), \\
|P_g|=1:\quad
q^*_{g,p}
  &= Q(\operatorname{clip}(\pi^{\mathrm{demand}}_p,0,1)).
\end{aligned}
`

export const LATEX_COMPONENT_PAIR_SHORTCUT = String.raw`
\begin{aligned}
\tau
  &= \max(0,\pi^{\mathrm{demand}}_a)
     + \max(0,\pi^{\mathrm{demand}}_b), \\
(\pi'_a,\pi'_b)
  &=
  \begin{cases}
    (\max(0,\pi^{\mathrm{demand}}_a),
     \max(0,\pi^{\mathrm{demand}}_b)), & \tau\le 1, \\
    \dfrac{1}{\tau}
    (\max(0,\pi^{\mathrm{demand}}_a),
     \max(0,\pi^{\mathrm{demand}}_b)), & \tau>1,
  \end{cases} \\
F
  &= Q(\pi'_a+\pi'_b), \\
(q^*_{g,a},q^*_{g,b})
  &= (0,0),\quad \text{if } \pi'_a+\pi'_b=0, \\
\delta
  &= F\frac{\pi'_a-\pi'_b}{\pi'_a+\pi'_b}, \\
q^*_{g,a}
  &= \operatorname{clip}\!\left(
       \frac{2-\sqrt{4(1-F)+\delta^2}+\delta}{2},0,1
     \right), \\
q^*_{g,b}
  &= \operatorname{clip}\!\left(
       \frac{2-\sqrt{4(1-F)+\delta^2}-\delta}{2},0,1
     \right).
\end{aligned}
`

export const LATEX_COMPONENT_DAMPED_UPDATE = String.raw`
\begin{aligned}
Q(\pi)
  &= \operatorname{clip}\!\left(
       \frac{\pi}{s-\pi(s-1)},0,1
     \right), \\
\widehat{\pi}_p(\mathbf q_g)
  &= \sum_{x\in\mathcal{S}_g}\mu_g(\mathbf q_g,x)x_p, \\
\widetilde q^{(k+1)}_{g,p}
  &=
  \begin{cases}
    0, & \pi^{\mathrm{demand}}_p \le 0, \\
    Q(\operatorname{clip}(\pi^{\mathrm{demand}}_p,0,1)),
      & \widehat{\pi}_p(\mathbf q^{(k)}_g) \le 0, \\
    \operatorname{clip}\!\left(
      q^{(k)}_{g,p}
      \dfrac{\pi^{\mathrm{demand}}_p}
            {\widehat{\pi}_p(\mathbf q^{(k)}_g)},
      0,1
    \right),
      & \text{otherwise},
  \end{cases} \\
\mathbf q^{(k+1)}_g
  &= (1-\eta)\mathbf q^{(k)}_g
     + \eta\widetilde{\mathbf q}^{(k+1)}_g
\end{aligned}
`

export const LATEX_COMPONENT_PROJECTED_PI = String.raw`
\begin{aligned}
\pi^{\mathrm{projected}}_p
  &= \widehat{\pi}_p(\mathbf q_g^{\mathrm{final}})
\end{aligned}
`

export const LATEX_COMPONENT_SHARE_BETA = String.raw`
\begin{aligned}
\operatorname{share}_{cp}
  &=
  \begin{cases}
    \dfrac{\beta^{\mathrm{demand}}_{cp}}
          {\pi^{\mathrm{demand}}_p},
      & \pi^{\mathrm{demand}}_p>0, \\
    0, & \text{otherwise},
  \end{cases} \\
\beta^{\mathrm{new}}_{cp}
  &= \operatorname{share}_{cp}\pi^{\mathrm{projected}}_p.
\end{aligned}
`

export const LATEX_LOOP_SUMMARY = String.raw`
\begin{aligned}
O_p
  &= \operatorname{openOpp}(p;\beta), \\
G_{cp}
  &= \operatorname{catOpen}(c,p;O,\beta), \\
D_{cp}
  &= \operatorname{draw}(c,p;\beta), \\
u_{cp}
  &= G_{cp}D_{cp}v_{cp}, \\
r_{cp}
  &= u_{cp}\int_0^1\prod_{q\neq p}(1-u_{cq}t)\,dt, \\
r_c
  &= \sum_p r_{cp}, \\
\rho_c
  &= \frac{s r_c}{1-r_c+r_c(s+d_c)}, \\
\beta^{\mathrm{demand}}_{cp}
  &=
  \begin{cases}
    r_{cp}\dfrac{\rho_c}{r_c}, & r_c > 0, \\
    0, & r_c = 0,
  \end{cases} \\
\pi^{\mathrm{demand}}_p
  &= \sum_c\beta^{\mathrm{demand}}_{cp}, \\
\mathcal{S}_g
  &= \{x\in\{0,1\}^{P_g}: x_i+x_j\le 1
      \text{ whenever } i\sim j\}, \\
Q(\pi)
  &= \operatorname{clip}\!\left(
       \frac{\pi}{s-\pi(s-1)},0,1
     \right), \\
\widehat{\pi}_p(\mathbf q_g)
  &= \sum_{x\in\mathcal{S}_g}\mu_g(\mathbf q_g,x)x_p, \\
\widetilde q^{(k+1)}_{g,p}
  &=
  \begin{cases}
    0, & \pi^{\mathrm{demand}}_p \le 0, \\
    Q(\operatorname{clip}(\pi^{\mathrm{demand}}_p,0,1)),
      & \widehat{\pi}_p(\mathbf q^{(k)}_g) \le 0, \\
    \operatorname{clip}\!\left(
      q^{(k)}_{g,p}
      \dfrac{\pi^{\mathrm{demand}}_p}
            {\widehat{\pi}_p(\mathbf q^{(k)}_g)},
      0,1
    \right),
      & \text{otherwise},
  \end{cases} \\
\mathbf q^{(k+1)}_g
  &= (1-\eta)\mathbf q^{(k)}_g
     + \eta\widetilde{\mathbf q}^{(k+1)}_g, \\
\pi^{\mathrm{projected}}_p
  &= \widehat{\pi}_p(\mathbf q_g^{\mathrm{final}}), \\
\operatorname{share}_{cp}
  &=
  \begin{cases}
    \dfrac{\beta^{\mathrm{demand}}_{cp}}
          {\pi^{\mathrm{demand}}_p},
      & \pi^{\mathrm{demand}}_p>0, \\
    0, & \text{otherwise},
  \end{cases} \\
\beta^{\mathrm{new}}_{cp}
  &= \operatorname{share}_{cp}\pi^{\mathrm{projected}}_p, \\
\beta_{cp}
  &\leftarrow (1-\lambda)\beta_{cp}
    + \lambda\beta^{\mathrm{new}}_{cp}.
\end{aligned}
`
