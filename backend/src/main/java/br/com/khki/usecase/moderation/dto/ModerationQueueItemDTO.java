package br.com.khki.usecase.moderation.dto;

import br.com.khki.usecase.contribution.dto.ContributionDTO;
import java.util.UUID;

public record ModerationQueueItemDTO(ContributionDTO contribution, String author, String address, String complement, String category, UUID thumbnailId, long version) {}
