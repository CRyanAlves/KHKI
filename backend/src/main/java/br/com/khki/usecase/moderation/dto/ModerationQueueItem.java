package br.com.khki.usecase.moderation.dto;

import br.com.khki.usecase.contribution.dto.ContributionView;
import java.util.UUID;

public record ModerationQueueItem(ContributionView contribution, String author, String address, String complement, String category, UUID thumbnailId, long version) {}
