import SwiftUI

/// Renders the printed layout for a page. This view is drawn behind the
/// PencilKit canvas (and rasterized to an image for the live editor), so it
/// must lay out deterministically at `LJTheme.pageSize`.
struct TemplateBackground: View {
    let template: PageTemplate
    /// Cover-only context.
    var coverTitle: String = "Life Journal"
    var coverScripture: String = ""
    var coverStyle: CoverStyle = .sage

    var body: some View {
        ZStack {
            LJTheme.paper
            content
                .padding(LJTheme.margin)
        }
        .frame(width: LJTheme.pageSize.width, height: LJTheme.pageSize.height)
    }

    @ViewBuilder
    private var content: some View {
        switch template {
        case .cover:            CoverTemplate(title: coverTitle, scripture: coverScripture, style: coverStyle)
        case .soap:             SoapTemplate()
        case .sermonNotes:      SermonNotesTemplate()
        case .prayerList:       PrayerListTemplate()
        case .gratitude:        GratitudeTemplate()
        case .dailyPlanner:     DailyPlannerTemplate()
        case .weeklyTop3:       WeeklyTop3Template()
        case .weeklySchedule:   WeeklyScheduleTemplate()
        case .monthlyCalendar:  MonthlyCalendarTemplate()
        case .notesTasks:       NotesTasksTemplate()
        case .lined:            LinedTemplate()
        case .dotted:           DottedTemplate()
        case .blank:            Color.clear
        }
    }
}

// MARK: - Cover

private struct CoverTemplate: View {
    let title: String
    let scripture: String
    let style: CoverStyle

    var body: some View {
        ZStack {
            LinearGradient(colors: [style.primary, style.secondary],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
            // inner keyline frame
            RoundedRectangle(cornerRadius: 6)
                .stroke(style.foil.opacity(0.6), lineWidth: 1.5)
                .padding(34)

            VStack(spacing: 28) {
                Spacer()
                Image(systemName: "cross")
                    .font(.system(size: 46, weight: .light))
                    .foregroundColor(style.foil)
                Text(title)
                    .font(.system(size: 64, weight: .bold, design: .serif))
                    .foregroundColor(style.foil)
                    .multilineTextAlignment(.center)
                    .lineLimit(3)
                    .minimumScaleFactor(0.5)
                    .padding(.horizontal, 24)
                Rectangle()
                    .fill(style.foil.opacity(0.8))
                    .frame(width: 120, height: 1.5)
                if !scripture.isEmpty {
                    Text(scripture)
                        .font(.system(size: 20, weight: .regular, design: .serif))
                        .italic()
                        .foregroundColor(style.foil.opacity(0.95))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 70)
                }
                Spacer()
                Spacer()
                HStack(spacing: 12) {
                    Text("THIS JOURNAL BELONGS TO")
                        .font(.system(size: 12, weight: .semibold))
                        .tracking(2)
                        .foregroundColor(style.foil.opacity(0.85))
                    Rectangle().fill(style.foil.opacity(0.6)).frame(height: 1)
                }
                .padding(.bottom, 8)
            }
            .padding(60)
        }
        .padding(-LJTheme.margin) // cover bleeds to the page edge
    }
}

// MARK: - S.O.A.P. Daily Devotion

private struct SoapTemplate: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            HStack(alignment: .firstTextBaseline) {
                SectionLabel(text: "Daily Devotion", size: 22, color: LJTheme.ink)
                Spacer()
                FieldLine(label: "Date", labelWidth: 48).frame(width: 240)
            }
            FieldLine(label: "Passage", labelWidth: 92)

            block("Scripture", "Write out the verse that speaks to you.", lines: 3)
            block("Observation", "What is happening? What is God showing you?", lines: 3)
            block("Application", "How will you live this out today?", lines: 3)
            block("Prayer", "Talk to God about what you read.", lines: 3)
            Spacer(minLength: 0)
        }
    }

    private func block(_ title: String, _ caption: String, lines: Int) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Circle().fill(LJTheme.accent).frame(width: 7, height: 7)
                SectionLabel(text: title, size: 15, color: LJTheme.ink)
                Text("— \(caption)")
                    .font(.system(size: 13)).italic().foregroundColor(LJTheme.softInk)
            }
            VStack(spacing: 0) {
                ForEach(0..<lines, id: \.self) { _ in
                    HairlineRule(color: LJTheme.faint).padding(.top, 40)
                }
            }
        }
    }
}

// MARK: - Sermon Notes

private struct SermonNotesTemplate: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            SectionLabel(text: "Sermon Notes", size: 22, color: LJTheme.ink)
            HStack(spacing: 30) {
                FieldLine(label: "Date", labelWidth: 48)
                FieldLine(label: "Speaker", labelWidth: 74)
            }
            HStack(spacing: 30) {
                FieldLine(label: "Series", labelWidth: 60)
                FieldLine(label: "Passage", labelWidth: 74)
            }
            HairlineRule().padding(.top, 4)
            SectionLabel(text: "Message", size: 14)
            RuledLines(spacing: 46)
                .frame(maxWidth: .infinity)
                .frame(height: 560)
            HStack(alignment: .top, spacing: 30) {
                LabeledBlock(title: "Key Verse") {
                    VStack(spacing: 36) { HairlineRule(color: LJTheme.faint); HairlineRule(color: LJTheme.faint) }
                }
                LabeledBlock(title: "How I'll Apply This") {
                    VStack(spacing: 36) { HairlineRule(color: LJTheme.faint); HairlineRule(color: LJTheme.faint) }
                }
            }
            Spacer(minLength: 0)
        }
    }
}

// MARK: - Prayer List

private struct PrayerListTemplate: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack(alignment: .firstTextBaseline) {
                SectionLabel(text: "Prayer List", size: 22, color: LJTheme.ink)
                Spacer()
                FieldLine(label: "Week of", labelWidth: 78).frame(width: 280)
            }
            Caption(text: "“Do not be anxious about anything… present your requests to God.” — Philippians 4:6")
            HStack(alignment: .top, spacing: 40) {
                VStack(alignment: .leading, spacing: 14) {
                    SectionLabel(text: "Requests", size: 15, color: LJTheme.ink)
                    CheckboxRows(count: 9)
                }
                VStack(alignment: .leading, spacing: 14) {
                    SectionLabel(text: "Answered Prayers", size: 15, color: LJTheme.ink)
                    CheckboxRows(count: 9)
                }
            }
            Spacer(minLength: 0)
        }
    }
}

// MARK: - Gratitude

private struct GratitudeTemplate: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            HStack(alignment: .firstTextBaseline) {
                SectionLabel(text: "Gratitude", size: 22, color: LJTheme.ink)
                Spacer()
                FieldLine(label: "Date", labelWidth: 48).frame(width: 240)
            }
            Caption(text: "“Give thanks in all circumstances.” — 1 Thessalonians 5:18")
            LabeledBlock(title: "Today I'm thankful for") {
                NumberedRows(count: 5)
            }
            .padding(.top, 6)
            LabeledBlock(title: "God showed up today by…") {
                VStack(spacing: 0) {
                    ForEach(0..<4, id: \.self) { _ in HairlineRule(color: LJTheme.faint).padding(.top, 44) }
                }
            }
            .padding(.top, 10)
            LabeledBlock(title: "Someone I want to encourage") {
                HairlineRule(color: LJTheme.faint).padding(.top, 36)
            }
            .padding(.top, 10)
            Spacer(minLength: 0)
        }
    }
}

// MARK: - Daily Planner (mirrors the printed planner layout)

private struct DailyPlannerTemplate: View {
    private let hours = ["6", "7", "8", "9", "10", "11", "12",
                         "1", "2", "3", "4", "5", "6", "7", "8", "9"]
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .firstTextBaseline, spacing: 16) {
                SectionLabel(text: "Day", size: 26, color: LJTheme.ink)
                Rectangle().fill(LJTheme.rule).frame(height: 1).offset(y: -6)
                Text("/        /").font(.system(size: 20, weight: .regular)).foregroundColor(LJTheme.softInk)
            }
            HStack(alignment: .top, spacing: 34) {
                // Schedule column
                VStack(alignment: .leading, spacing: 10) {
                    SectionLabel(text: "Schedule", size: 14)
                    VStack(spacing: 0) {
                        ForEach(hours, id: \.self) { h in
                            HStack(alignment: .bottom, spacing: 12) {
                                Text(h)
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundColor(LJTheme.softInk)
                                    .frame(width: 26, alignment: .trailing)
                                Rectangle().fill(LJTheme.faint).frame(height: 1).offset(y: -4)
                            }
                            .frame(height: 52)
                        }
                    }
                }
                .frame(width: 430)

                // Right column
                VStack(alignment: .leading, spacing: 26) {
                    LabeledBlock(title: "Top Priorities") {
                        NumberedRows(count: 3, spacing: 50)
                    }
                    LabeledBlock(title: "Notes / Tasks") {
                        CheckboxRows(count: 6, spacing: 48)
                    }
                    LabeledBlock(title: "Today's Verse") {
                        VStack(spacing: 34) { HairlineRule(color: LJTheme.faint); HairlineRule(color: LJTheme.faint) }
                    }
                }
            }
            Spacer(minLength: 0)
        }
    }
}

// MARK: - Weekly Top 3

private struct WeeklyTop3Template: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 26) {
            HStack(alignment: .firstTextBaseline) {
                SectionLabel(text: "Weekly Top 3", size: 26, color: LJTheme.ink)
                Spacer()
                FieldLine(label: "Week of", labelWidth: 78).frame(width: 280)
            }
            Caption(text: "Three tasks that must be completed this week.")
            VStack(spacing: 26) {
                ForEach(1...3, id: \.self) { n in
                    HStack(alignment: .top, spacing: 20) {
                        Text("\(n)")
                            .font(.system(size: 40, weight: .bold, design: .serif))
                            .foregroundColor(LJTheme.accent)
                            .frame(width: 56)
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(LJTheme.rule, lineWidth: 1.5)
                            .frame(height: 150)
                    }
                }
            }
            .padding(.top, 8)
            LabeledBlock(title: "Notes") {
                RuledLines(spacing: 46).frame(height: 230)
            }
            .padding(.top, 6)
            Spacer(minLength: 0)
        }
    }
}

// MARK: - Weekly Schedule

private struct WeeklyScheduleTemplate: View {
    private let days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .firstTextBaseline) {
                SectionLabel(text: "Weekly Schedule", size: 24, color: LJTheme.ink)
                Spacer()
                FieldLine(label: "Week of", labelWidth: 78).frame(width: 280)
            }
            VStack(spacing: 0) {
                ForEach(Array(days.enumerated()), id: \.offset) { idx, day in
                    VStack(alignment: .leading, spacing: 8) {
                        SectionLabel(text: day, size: 13,
                                     color: idx >= 5 ? LJTheme.accent : LJTheme.ink)
                        HairlineRule(color: LJTheme.faint)
                    }
                    .frame(height: idx >= 5 ? 110 : 130, alignment: .top)
                }
            }
            Spacer(minLength: 0)
        }
    }
}

// MARK: - Monthly Calendar

private struct MonthlyCalendarTemplate: View {
    private let weekdays = ["S", "M", "T", "W", "T", "F", "S"]
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .firstTextBaseline, spacing: 16) {
                SectionLabel(text: "Month", size: 24, color: LJTheme.ink)
                Rectangle().fill(LJTheme.rule).frame(width: 320, height: 1).offset(y: -6)
                Spacer()
            }
            GeometryReader { geo in
                let cols = 7
                let rows = 6
                let cellW = geo.size.width / CGFloat(cols)
                let headerH: CGFloat = 34
                let cellH = (geo.size.height - headerH) / CGFloat(rows)
                VStack(spacing: 0) {
                    HStack(spacing: 0) {
                        ForEach(0..<cols, id: \.self) { c in
                            Text(weekdays[c])
                                .font(.system(size: 13, weight: .semibold)).tracking(2)
                                .foregroundColor(c == 0 || c == 6 ? LJTheme.accent : LJTheme.softInk)
                                .frame(width: cellW, height: headerH)
                        }
                    }
                    ForEach(0..<rows, id: \.self) { _ in
                        HStack(spacing: 0) {
                            ForEach(0..<cols, id: \.self) { _ in
                                Rectangle()
                                    .stroke(LJTheme.faint, lineWidth: 1)
                                    .frame(width: cellW, height: cellH)
                            }
                        }
                    }
                }
            }
            Spacer(minLength: 0)
        }
    }
}

// MARK: - Notes / Tasks

private struct NotesTasksTemplate: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .firstTextBaseline) {
                SectionLabel(text: "Notes / Tasks", size: 22, color: LJTheme.ink)
                Spacer()
                FieldLine(label: "Date", labelWidth: 48).frame(width: 240)
            }
            CheckboxRows(count: 18, spacing: 56)
            Spacer(minLength: 0)
        }
    }
}

// MARK: - Plain paper

private struct LinedTemplate: View {
    var body: some View { RuledLines(spacing: 48) }
}

private struct DottedTemplate: View {
    var body: some View { DotGrid(spacing: 42) }
}
