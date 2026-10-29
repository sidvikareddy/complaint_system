package com.campus.complaints.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum ComplaintStatus {
    PENDING("Pending"), IN_PROGRESS("In Progress"), RESOLVED("Resolved"), REJECTED("Rejected");
    private final String value;
    ComplaintStatus(String value) { this.value = value; }
    @JsonValue public String value() { return value; }
    @JsonCreator public static ComplaintStatus fromValue(String value) {
        if (value == null) return null;
        return valueOf(value.trim().replace(' ', '_').toUpperCase());
    }
}
