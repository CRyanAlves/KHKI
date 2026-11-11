package br.com.khki.usecase.image;

import java.util.UUID;

/** URLs estáveis da API; os arquivos permanecem privados no armazenamento. */
public final class ImageUrls {
  private ImageUrls() {}

  public static String url(UUID id) { return "/api/photos/" + id; }
  public static UUID id(String url) {
    if (url == null || !url.startsWith("/api/photos/")) throw new IllegalArgumentException("Referência de imagem inválida.");
    return UUID.fromString(url.substring("/api/photos/".length()));
  }
}
