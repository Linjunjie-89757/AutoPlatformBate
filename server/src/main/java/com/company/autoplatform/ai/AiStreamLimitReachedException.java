package com.company.autoplatform.ai;

final class AiStreamLimitReachedException extends RuntimeException {

    AiStreamLimitReachedException() {
        super("AI generation stream reached the accepted case limit");
    }
}
