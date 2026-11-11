package br.com.khki.infrastructure.storage;

import java.util.UUID;

public interface ImageStorage {
  void put(UUID id, byte[] bytes);
  byte[] read(UUID id);
  void delete(UUID id);
}
