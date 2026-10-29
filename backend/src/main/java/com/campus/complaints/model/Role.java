package com.campus.complaints.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum Role {
    STUDENT("student"), STAFF("staff"), ADMIN("admin");
    private final String value;
    Role(String value) { this.value = value; }
    @JsonValue public String value() { return value; }
    @JsonCreator public static Role fromValue(String value) {
        return value == null ? null : valueOf(value.trim().toUpperCase());
    }
}
