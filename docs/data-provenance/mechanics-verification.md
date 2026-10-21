# Test Mechanics Verification — USCIS Naturalization Civics Test (2008 and 2025 versions)

Retrieved: 2026-10-21

## Sources used

| # | Source | URL | How obtained |
|---|--------|-----|--------------|
| S1 | USCIS Policy Manual, Vol. 12, Part E, Ch. 2 | https://www.uscis.gov/policy-manual/volume-12-part-e-chapter-2 | WebFetch, 2026-10-21 (quotes below were extracted by the fetch tool's summarizer from the live page) |
| S2 | Federal Register, "Notice of Implementation of 2025 Naturalization Civics Test," 90 FR 45047 (Sept. 18, 2025), FR Doc. 2025-18050 | https://www.govinfo.gov/content/pkg/FR-2025-09-18/pdf/2025-18050.pdf (official PDF; federalregister.gov HTML blocked automated fetch) | Full PDF downloaded and text-extracted; quotes below are exact |
| S3 | USCIS, "Civics (History and Government) Questions for the Naturalization Test" (100q.pdf, rev. 01/19) | https://www.uscis.gov/sites/default/files/document/questions-and-answers/100q.pdf | Full PDF downloaded; quotes exact |
| S4 | USCIS, "128 Civics Questions and Answers (2025 version)," M-1778 (09/25) | https://www.uscis.gov/sites/default/files/document/questions-and-answers/2025-Civics-Test-128-Questions-and-Answers.pdf | Full PDF downloaded; quotes exact |
| S5 | USCIS, "Civics Questions for the 65/20 Exemption" (rev. 01/19) | https://www.uscis.gov/sites/default/files/document/questions-and-answers/65-20q.pdf | Full PDF downloaded; used to verify the 2008 asterisked (65/20) question list |
| S6 | USCIS, M-1781 (11/20), "Civics Questions and Answers for the 65/20 Special Consideration (2020 version)" | https://www.uscis.gov/sites/default/files/document/crc/Civics%20Questions%20and%20Answers.pdf | Full PDF downloaded; used as a cross-check of the 2025 asterisked list (the 2025 test reimplements the 2020 test with the same 20 designated questions) |

## 1. 2008 test mechanics: up to 10 asked, 6 correct to pass, 5 incorrect to fail, early stop

From S1 (Policy Manual):
> "The standardized civics test contains 10 questions."
> "answer correctly at least six out of 10 questions"
> "The officer stops the test once the alien correctly answers the minimum number of six questions required to pass the test, or answers five questions incorrectly."

From S3 (2008 question PDF, intro, exact):
> "The civics test is an oral test and the USCIS Officer will ask the applicant up to 10 of the 100 civics questions. An applicant must answer 6 out of 10 questions correctly to pass the civics portion of the naturalization test."

From S2 (Federal Register, exact, 90 FR 45050):
> "This was a change from the 2008 Naturalization Civics Test where USCIS administered a 10-question test of which the alien had to answer six questions correctly."
> "This was a change from the 2008 Naturalization Civics Test where the officers were only required to orally ask questions until the alien either passed or failed the test."

Encoded in `bank-2008.json` as `questionsAsked: 10, passAt: 6, failAt: 5, earlyStop: true`.

## 2. 2025 test mechanics: 20 asked, 12 correct to pass, 9 incorrect to fail, early stop both directions

From S2 (Federal Register, exact, 90 FR 45050):
> "In implementing the 2025 Naturalization Civics Test, USCIS will resume administering 20-question tests using the same bank of 128 questions and answers that it used for the 2020 Naturalization Civics Test."
> "In implementing the 2025 Naturalization Civics Test, officers will only be required to ask questions until the alien either passes or fails the test. This is the only difference from the 2020 Naturalization Civics Test. Therefore, when an alien answers 12 questions correctly, the officer will stop administering the test. Similarly, when an alien answers nine questions incorrectly thus failing the test, the officer will stop administering the test."

From S1 (Policy Manual):
> "The standardized civics test contains 20 questions." / "answering at least 12 of 20 questions correctly" / "The officer stops the test once the alien correctly answers the minimum of 12 questions required to pass the test, or answers nine questions incorrectly."

From S4 (2025 question PDF, intro, exact):
> "The civics test is an oral test and the USCIS officer will ask you to answer up to 20 out of the 128 civics test questions. You must answer at least 12 questions correctly to pass the 2025 version of the civics test."

Encoded in `bank-2025.json` as `questionsAsked: 20, passAt: 12, failAt: 9, earlyStop: true`.

## 3. Filing-date cutoff: October 20, 2025

From S2 (Federal Register, DATES section, exact):
> "This notice is effective on September 18, 2025. USCIS will administer the 2025 Naturalization Civics Test to aliens who file their naturalization applications on or after October 20, 2025."

From S2 (Implementation section, exact):
> "1. Aliens who have already filed a naturalization application, or who file a naturalization application less than 30 days after this notice is published in the Federal Register, will take the 2008 Naturalization Civics Test;
> 2. Aliens who file a naturalization application 30 days or more after this notice is published in the Federal Register will take the 2025 Naturalization Civics Test;"

From S1 (Policy Manual):
> "Aliens who filed a naturalization application before October 20, 2025, must take the 2008 Naturalization Civics Test."

## 4. 65/20 special consideration (both versions): 10 questions from a designated list of 20, 6 correct to pass

Statutory basis (S2): INA sec. 312(b)(3), 8 U.S.C. 1423(b)(3).

From S2 (Federal Register, exact):
> "3. With respect to aliens who qualify for special consideration because they are age 65 or older and have resided in the U.S. as a lawful permanent resident for at least 20 years, USCIS will continue to administer a test with 10 questions from a specially selected bank of 20 test questions from either the 2008 or 2025 Naturalization Civics Test. ... Regardless of their filing date, these aliens will only need to answer six questions correctly to achieve a passing score."

From S1 (Policy Manual):
> "The civics test for aliens given special consideration contains 10 questions." The alien "passes the civics test if he or she provides a correct answer ... for at least six of 10 civics test questions from the specially designated list of 20 questions."

2008 designation (S3, footnote on every page, exact):
> "* If you are 65 years old or older and have been a legal permanent resident of the United States for 20 or more years, you may study just the questions that have been marked with an asterisk."

The 2008 designated list was verified question-by-question against S5 (the standalone 65/20 PDF), which lists exactly these 20 questions of the 100-question bank: 6, 11, 13, 17, 20, 27, 28, 44, 45, 49, 54, 56, 70, 75, 78, 85, 94, 95, 97, 99.

2025 designation (S4, intro, exact):
> "If you are 65 years old or older and have been living in the United States as a lawful permanent resident of the United States for 20 or more years, you may study just the 20 questions that have been marked with an asterisk ( * ) found at the end of each question. You may also take the civics test in the language of your choice. The USCIS officer will ask you to answer 10 out of the 20 civics test questions with an asterisk. You must answer at least 6 out of 10 questions (or 60%) correctly to pass the 2025 version of the civics test."

The 20 asterisked questions found in the 2025 PDF are: 2, 7, 12, 20, 30, 36, 38, 39, 44, 52, 61, 66, 74, 78, 86, 94, 113, 115, 121, 126. Cross-checked against S6 (the 2020-version standalone 65/20 document, M-1781): the 2020 and 2025 designated questions are the same 20 (the Federal Register states the 2025 test uses "the same bank of 128 questions and answers that it used for the 2020 Naturalization Civics Test"; the only mechanics change is early stop).

Encoded in both banks as `senior6520: { designatedOnly: true, questionsAsked: 10, passAt: 6 }`.

## Items not fully verified / caveats

1. **2008 fail threshold ("failAt": 5).** The explicit number five appears in the Policy Manual quote (S1); the Federal Register (S2) confirms only that 2008-test officers stopped "until the alien either passed or failed." Five incorrect is also mathematically the earliest failing point of a 10-question/6-to-pass test. Confidence: high, but the "5" figure rests on S1.
2. **Policy Manual quotes (S1) were obtained via the WebFetch summarizer**, not raw page text (uscis.gov page scripts prevent full raw capture). They are consistent with the exact Federal Register text (S2) and both question PDFs (S3, S4). If exact-citation fidelity to the Policy Manual is required, re-verify against the live page.
3. **65/20 early-stop/fail-count:** none of the sources state an explicit incorrect-answer fail threshold or early-stop rule specific to the 65/20 10-question test; the schema does not require one and none was encoded.
4. The 2008 PDF used (S3) is the current USCIS-hosted revision "rev. 01/19", which refers dynamic officeholder answers to uscis.gov/citizenship/testupdates rather than printing names. This is the live official document at the canonical 100q.pdf URL as of 2026-10-21.
