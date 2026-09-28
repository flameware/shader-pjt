// Signed distance from p to a circle of radius r centred at the origin (negative inside).
float circle(vec2 p, float r) {
  return length(p) - r;
}
