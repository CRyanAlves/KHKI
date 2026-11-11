package br.com.khki.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@Entity
@Table(name = "bathrooms")
public class Bathroom extends ModeratedContent {

  @Column(nullable = false, length = 120)
  private String name;

  @Column(nullable = false, length = 300)
  private String address;

  @Column(length = 200)
  private String complement;

  @Column(nullable = false, length = 80)
  private String category;

  private double latitude;
  private double longitude;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private Access access;

  @Column(length = 300)
  private String accessDetails;

  @Column(length = 200)
  private String hours;

  private Boolean accessible;

  @ElementCollection(fetch = FetchType.LAZY)
  @CollectionTable(name = "bathroom_items", joinColumns = @JoinColumn(name = "bathroom_id"))
  @Column(name = "item_code", nullable = false, length = 30)
  private Set<String> items = new TreeSet<>();

  private boolean demo;

  @Column(length = 20)
  private String usageRestriction;

  @Column(length = 12)
  private String charging;

  @Column(precision = 8, scale = 2)
  private BigDecimal feeAmount;

  @ElementCollection(fetch = FetchType.LAZY)
  @CollectionTable(name = "bathroom_types", joinColumns = @JoinColumn(name = "bathroom_id"))
  @Column(name = "type_code", nullable = false, length = 20)
  private Set<String> bathroomTypes = new TreeSet<>();

  private Boolean stepFreeAccess;
  private Boolean elevator;
  private Boolean adaptedCabin;
  private Boolean grabBars;
  private LocalDate lastVisited;

  @OneToMany(mappedBy = "bathroom", fetch = FetchType.LAZY)
  @com.fasterxml.jackson.annotation.JsonIgnore
  private Set<Review> reviews = new HashSet<>();

  @ElementCollection(fetch = FetchType.LAZY)
  @CollectionTable(name = "bathroom_images", joinColumns = @JoinColumn(name = "bathroom_id"))
  @OrderColumn(name = "image_order")
  private List<ImageReference> images = new ArrayList<>();

  public String getName() { return name; }
  public void setName(String value) { name = value; }

  public String getAddress() { return address; }
  public void setAddress(String value) { address = value; }

  public String getComplement() { return complement; }
  public void setComplement(String value) { complement = value; }

  public String getCategory() { return category; }
  public void setCategory(String value) { category = value; }

  public double getLatitude() { return latitude; }
  public void setLatitude(double value) { latitude = value; }

  public double getLongitude() { return longitude; }
  public void setLongitude(double value) { longitude = value; }

  public Access getAccess() { return access; }
  public void setAccess(Access value) { access = value; }

  public String getAccessDetails() { return accessDetails; }
  public void setAccessDetails(String value) { accessDetails = value; }

  public String getHours() { return hours; }
  public void setHours(String value) { hours = value; }

  public Boolean getAccessible() { return accessible; }
  public void setAccessible(Boolean value) { accessible = value; }

  public Set<String> getItems() { return items; }
  public void setItems(Set<String> value) { items = value; }

  public boolean getDemo() { return demo; }
  public void setDemo(boolean value) { demo = value; }

  public String getUsageRestriction() { return usageRestriction; }
  public void setUsageRestriction(String value) { usageRestriction = value; }

  public String getCharging() { return charging; }
  public void setCharging(String value) { charging = value; }

  public BigDecimal getFeeAmount() { return feeAmount; }
  public void setFeeAmount(BigDecimal value) { feeAmount = value; }

  public Set<String> getBathroomTypes() { return bathroomTypes; }
  public void setBathroomTypes(Set<String> value) { bathroomTypes = value; }

  public Boolean getStepFreeAccess() { return stepFreeAccess; }
  public void setStepFreeAccess(Boolean value) { stepFreeAccess = value; }

  public Boolean getElevator() { return elevator; }
  public void setElevator(Boolean value) { elevator = value; }

  public Boolean getAdaptedCabin() { return adaptedCabin; }
  public void setAdaptedCabin(Boolean value) { adaptedCabin = value; }

  public Boolean getGrabBars() { return grabBars; }
  public void setGrabBars(Boolean value) { grabBars = value; }

  public LocalDate getLastVisited() { return lastVisited; }
  public void setLastVisited(LocalDate value) { lastVisited = value; }

  public Set<Review> getReviews() { return reviews; }
  public void setReviews(Set<Review> value) { reviews = value; }

  public List<ImageReference> getImages() { return images; }
  public void setImages(List<ImageReference> value) { images = value; }
}
