package br.com.khki;

import static org.assertj.core.api.Assertions.*;

import br.com.khki.shared.domain.GeographicDistance;
import org.junit.jupiter.api.Test;

class GeographicDistanceTest {

  @Test
  void usesMetersAndPreservesSymmetryAndCoincidentPoints() {
    assertThat(GeographicDistance.meters(-23.1, -47.2, -23.1, -47.2)).isZero();
    assertThat(GeographicDistance.meters(0, 0, 0, 1)).isCloseTo(111194.93, within(0.01));
    assertThat(GeographicDistance.meters(-23.1, -47.2, -23.2, -47.3)).isCloseTo(GeographicDistance.meters(-23.2, -47.3, -23.1, -47.2), within(0.000001));
  }

  @Test
  void handlesAntipodalPointsWithoutRoundingIntoNan() {
    for (double latitude : new double[] { 0, 23.1, 45, 89.99 }) {
      assertThat(GeographicDistance.meters(latitude, 0, -latitude, 180))
        .isFinite()
        .isCloseTo(Math.PI * 6371000, within(0.2));
    }
  }
}
