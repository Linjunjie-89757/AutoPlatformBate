package com.company.autoplatform.webuiautomation;

import com.company.autoplatform.common.BadRequestException;
import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.FileChooser;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.PlaywrightException;
import com.microsoft.playwright.options.BoundingBox;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class WebUiPlaywrightBrowserRunner implements WebUiBrowserRunner {

    private final WebUiLocatorSupport locatorSupport;

    public WebUiPlaywrightBrowserRunner(WebUiLocatorSupport locatorSupport) {
        this.locatorSupport = locatorSupport;
    }

    @Override
    public List<StepExecutionResult> run(WebUiRunContext context) {
        List<StepExecutionResult> results = new ArrayList<>();
        try (Playwright playwright = Playwright.create();
             Browser browser = browserType(playwright, context.browserType())
                     .launch(new BrowserType.LaunchOptions().setHeadless(context.headless()));
             BrowserContext browserContext = browser.newContext()) {
            browserContext.setDefaultTimeout(context.defaultTimeoutMs());
            Page page = browserContext.newPage();
            for (WebUiCaseStepEntity step : context.steps()) {
                results.add(executeStep(page, context.baseUrl(), step));
                if (!results.get(results.size() - 1).success() && !Boolean.TRUE.equals(step.getContinueOnFailure())) {
                    break;
                }
            }
        }
        return results;
    }

    private StepExecutionResult executeStep(Page page, String baseUrl, WebUiCaseStepEntity step) {
        long startedAt = System.nanoTime();
        try {
            byte[] screenshotBytes = null;
            switch (step.getStepType()) {
                case "OPEN" -> page.navigate(WebUiExecutionEngineSupport.resolveOpenUrl(step.getInputValue(), baseUrl));
                case "CLICK" -> locator(page, step).click();
                case "FILL" -> locator(page, step).fill(requiredInput(step));
                case "CLEAR" -> locator(page, step).clear();
                case "HOVER" -> locator(page, step).hover();
                case "DRAG_TO" -> locator(page, step).dragTo(dragTarget(page, step));
                case "DRAG_COORDINATES" -> dragCoordinates(page, step);
                case "DOUBLE_CLICK" -> locator(page, step).dblclick();
                case "RIGHT_CLICK" -> locator(page, step).click(new Locator.ClickOptions().setButton(com.microsoft.playwright.options.MouseButton.RIGHT));
                case "PRESS_KEY" -> page.keyboard().press(requiredInput(step));
                case "SELECT" -> locator(page, step).selectOption(requiredInput(step));
                case "FILE_UPLOAD" -> locator(page, step).setInputFiles(java.nio.file.Path.of(requiredInput(step)));
                case "FILE_PICKER" -> chooseFile(page, step);
                case "WAIT_FOR" -> locator(page, step).waitFor();
                case "ASSERT_VISIBLE" -> assertVisible(page, step);
                case "ASSERT_TEXT" -> assertText(page, step);
                case "ASSERT_URL" -> assertUrl(page, step);
                case "ASSERT_TITLE" -> assertTitle(page, step);
                case "ASSERT_ATTRIBUTE" -> assertAttribute(page, step);
                case "ASSERT_COUNT" -> assertCount(page, step);
                case "SCREENSHOT" -> screenshotBytes = page.screenshot();
                default -> throw new BadRequestException("Unsupported step type: " + step.getStepType());
            }
            return new StepExecutionResult(step, true, elapsedMs(startedAt), null, screenshotBytes);
        } catch (PlaywrightException | BadRequestException | IllegalArgumentException exception) {
            return new StepExecutionResult(step, false, elapsedMs(startedAt), buildFailureMessage(step, exception), captureFailureScreenshot(page));
        }
    }

    private void assertVisible(Page page, WebUiCaseStepEntity step) {
        if (!locator(page, step).isVisible()) {
            throw new BadRequestException("Element is not visible: " + step.getLocatorValue());
        }
    }

    private void assertText(Page page, WebUiCaseStepEntity step) {
        String actual = locator(page, step).textContent();
        String expected = requiredInput(step);
        if (actual == null || !actual.contains(expected)) {
            throw new BadRequestException("Element text does not contain expected value. expected="
                    + expected + ", actual=" + (actual == null ? "<empty>" : actual));
        }
    }

    private void assertUrl(Page page, WebUiCaseStepEntity step) {
        String expected = requiredInput(step);
        if (!page.url().contains(expected)) {
            throw new BadRequestException("Current URL does not contain expected value. expected="
                    + expected + ", actual=" + page.url());
        }
    }

    private void assertTitle(Page page, WebUiCaseStepEntity step) {
        String expected = requiredInput(step);
        if (!page.title().contains(expected)) {
            throw new BadRequestException("Current title does not contain expected value. expected="
                    + expected + ", actual=" + page.title());
        }
    }

    private void assertAttribute(Page page, WebUiCaseStepEntity step) {
        WebUiExecutionEngineSupport.AttributeExpectation expectation =
                WebUiExecutionEngineSupport.parseAttributeExpectation(requiredInput(step));
        String actual = locator(page, step).getAttribute(expectation.name());
        if (actual == null || !actual.contains(expectation.expectedValue())) {
            throw new BadRequestException("Element attribute does not contain expected value. attribute="
                    + expectation.name() + ", expected=" + expectation.expectedValue()
                    + ", actual=" + (actual == null ? "<empty>" : actual));
        }
    }

    private void assertCount(Page page, WebUiCaseStepEntity step) {
        int actual = locator(page, step).count();
        String expected = requiredInput(step);
        if (!WebUiExecutionEngineSupport.matchesCountExpectation(actual, expected)) {
            throw new BadRequestException("Element count does not match expected value. expected="
                    + expected + ", actual=" + actual);
        }
    }

    String buildFailureMessage(WebUiCaseStepEntity step, Exception exception) {
        List<String> parts = new ArrayList<>();
        parts.add("失败类型：" + classifyFailure(step, exception));
        parts.add("步骤：" + formatStepLabel(step));
        String locator = formatLocator(step);
        if (locator != null) {
            parts.add("定位器：" + locator);
        }
        String inputValue = WebUiAutomationFormatSupport.blankToNull(step == null ? null : step.getInputValue());
        if (inputValue != null) {
            parts.add("输入/目标：" + inputValue);
        }
        Integer timeoutMs = step == null ? null : step.getTimeoutMs();
        if (timeoutMs != null && timeoutMs > 0) {
            parts.add("超时：" + timeoutMs + " ms");
        }
        String rawMessage = WebUiAutomationFormatSupport.blankToNull(exception == null ? null : exception.getMessage());
        if (rawMessage != null) {
            parts.add("原始错误：" + rawMessage);
        }
        return String.join("；", parts);
    }

    private String classifyFailure(WebUiCaseStepEntity step, Exception exception) {
        String stepType = step == null ? "" : String.valueOf(step.getStepType()).toUpperCase(Locale.ROOT);
        String message = exception == null || exception.getMessage() == null
                ? ""
                : exception.getMessage().toLowerCase(Locale.ROOT);
        if ("OPEN".equals(stepType)) {
            return "页面打开失败";
        }
        if (stepType.startsWith("ASSERT_") || message.contains("expected") || message.contains("assert")) {
            return "断言失败";
        }
        if (message.contains("timeout") || message.contains("timed out")) {
            return "等待超时";
        }
        if (message.contains("locator")
                || message.contains("strict mode violation")
                || message.contains("element is not visible")
                || WebUiAutomationFormatSupport.blankToNull(step == null ? null : step.getLocatorValue()) != null) {
            return "定位器未找到或不可用";
        }
        return "执行异常";
    }

    private String formatStepLabel(WebUiCaseStepEntity step) {
        if (step == null) {
            return "-";
        }
        StringBuilder builder = new StringBuilder();
        if (step.getSortOrder() != null) {
            builder.append("第 ").append(step.getSortOrder()).append(" 步 ");
        }
        String stepName = WebUiAutomationFormatSupport.blankToNull(step.getStepName());
        if (stepName != null) {
            builder.append(stepName);
        } else {
            builder.append("未命名步骤");
        }
        builder.append("（").append(WebUiAutomationFormatSupport.blankToNull(step.getStepType()) == null ? "-" : step.getStepType()).append("）");
        return builder.toString();
    }

    private String formatLocator(WebUiCaseStepEntity step) {
        if (step == null || WebUiAutomationFormatSupport.blankToNull(step.getLocatorValue()) == null) {
            return null;
        }
        String locatorType = WebUiAutomationFormatSupport.blankToNull(step.getLocatorType());
        return (locatorType == null ? "-" : locatorType) + ": " + step.getLocatorValue();
    }

    private Locator locator(Page page, WebUiCaseStepEntity step) {
        return locatorSupport.resolve(page, step.getLocatorType(), step.getLocatorValue());
    }

    private Locator dragTarget(Page page, WebUiCaseStepEntity step) {
        TargetLocator target = parseTargetLocator(requiredInput(step));
        return locatorSupport.resolve(page, target.locatorType(), target.locatorValue());
    }

    private void dragCoordinates(Page page, WebUiCaseStepEntity step) {
        BoundingBox box = locator(page, step).boundingBox();
        if (box == null) {
            throw new BadRequestException("Element bounding box is unavailable");
        }
        CoordinateDrag drag = parseCoordinateDrag(requiredInput(step));
        page.mouse().move(box.x + drag.fromX(), box.y + drag.fromY());
        page.mouse().down();
        page.mouse().move(box.x + drag.toX(), box.y + drag.toY());
        page.mouse().up();
    }

    private void chooseFile(Page page, WebUiCaseStepEntity step) {
        FileChooser fileChooser = page.waitForFileChooser(() -> locator(page, step).click());
        fileChooser.setFiles(java.nio.file.Path.of(requiredInput(step)));
    }

    private TargetLocator parseTargetLocator(String value) {
        int separatorIndex = value.indexOf('=');
        if (separatorIndex <= 0) {
            return new TargetLocator("CSS", value);
        }
        String locatorType = value.substring(0, separatorIndex).trim().toUpperCase(Locale.ROOT);
        String locatorValue = value.substring(separatorIndex + 1).trim();
        if (locatorValue.isBlank()) {
            throw new BadRequestException("Drag target locator value cannot be blank");
        }
        if (!List.of("CSS", "TEST_ID", "TEXT", "ROLE", "PLACEHOLDER", "LABEL", "XPATH").contains(locatorType)) {
            return new TargetLocator("CSS", value);
        }
        return new TargetLocator(locatorType, locatorValue);
    }

    private record TargetLocator(String locatorType, String locatorValue) {
    }

    private CoordinateDrag parseCoordinateDrag(String value) {
        Matcher matcher = Pattern
                .compile("-?\\d+(?:\\.\\d+)?")
                .matcher(value);
        List<Double> numbers = new ArrayList<>();
        while (matcher.find() && numbers.size() < 4) {
            numbers.add(Double.parseDouble(matcher.group()));
        }
        if (numbers.size() < 4) {
            throw new BadRequestException("Coordinate drag input must include fromX, fromY, toX and toY");
        }
        return new CoordinateDrag(numbers.get(0), numbers.get(1), numbers.get(2), numbers.get(3));
    }

    private record CoordinateDrag(double fromX, double fromY, double toX, double toY) {
    }

    private BrowserType browserType(Playwright playwright, String browserType) {
        return switch (WebUiAutomationFormatSupport.normalizeBrowserType(browserType)) {
            case "FIREFOX" -> playwright.firefox();
            case "WEBKIT" -> playwright.webkit();
            default -> playwright.chromium();
        };
    }

    private String requiredInput(WebUiCaseStepEntity step) {
        String inputValue = WebUiAutomationFormatSupport.blankToNull(step.getInputValue());
        if (inputValue == null) {
            throw new BadRequestException("Input value cannot be blank");
        }
        return inputValue;
    }

    private long elapsedMs(long startedAt) {
        return Math.max(0L, (System.nanoTime() - startedAt) / 1_000_000L);
    }

    private byte[] captureFailureScreenshot(Page page) {
        try {
            return page.screenshot();
        } catch (RuntimeException ignored) {
            return null;
        }
    }
}
