package br.com.khki.shared.domain;

public final class GeographicDistance {
  private static final double EARTH_RADIUS_METERS = 6371000;

  private GeographicDistance() {}

  public static double meters(double latitude, double longitude, double otherLatitude, double otherLongitude) {
    double deltaLatitude = Math.toRadians(otherLatitude - latitude);
    double deltaLongitude = Math.toRadians(otherLongitude - longitude);
    double haversine = Math.pow(Math.sin(deltaLatitude / 2), 2) + Math.cos(Math.toRadians(latitude)) * Math.cos(Math.toRadians(otherLatitude)) * Math.pow(Math.sin(deltaLongitude / 2), 2);
    double bounded = Math.max(0, Math.min(1, haversine));
    return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(bounded), Math.sqrt(1 - bounded));
  }
}
