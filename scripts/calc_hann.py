import math
N = 35
w = [0.5 * (1 - math.cos(2 * math.pi * n / (N - 1))) for n in range(N)]
s = sum(w)
norm_w = [x / s for x in w]
print(", ".join(f"{x:.6f}f" for x in norm_w))
