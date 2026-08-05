# Test Data Library

This library contains the ten realistic, synthetic datasets required for Wave -1 program initialization of the EdProSys Production Certification. 

As the database connection string and Supabase write credentials are not configured in the workspace env files (`.env.local`/`.env.production.local`), these datasets have been built as portable seed files (JSON) under `docs/15_Test_Data_Library/` to be imported/applied to the database once access is configured.

## Synthetic Datasets List

| Dataset Name | School ID | Tenant Type | Seed File Path | Teachers | Parents | Students | Fees | Attendance | Exams | Timetable |
|---|---|---|---|---|---|---|---|---|---|---|
| **TEST Small School Demo** | `TEST_SmallSchool_Demo` | Small School | `docs/15_Test_Data_Library/TEST_SmallSchool_Demo.json` | 3 | 5 | 5 | 5 | 15 | 10 | 25 |
| **TEST Medium School Demo** | `TEST_MediumSchool_Demo` | Medium School | `docs/15_Test_Data_Library/TEST_MediumSchool_Demo.json` | 5 | 10 | 10 | 10 | 30 | 20 | 50 |
| **TEST Large School Demo** | `TEST_LargeSchool_Demo` | Large School | `docs/15_Test_Data_Library/TEST_LargeSchool_Demo.json` | 10 | 20 | 20 | 20 | 60 | 40 | 100 |
| **TEST Intermediate College Demo** | `TEST_IntermediateCollege_Demo` | Intermediate College | `docs/15_Test_Data_Library/TEST_IntermediateCollege_Demo.json` | 6 | 12 | 12 | 12 | 36 | 36 | 60 |
| **TEST Engineering College Demo** | `TEST_EngineeringCollege_Demo` | Engineering College | `docs/15_Test_Data_Library/TEST_EngineeringCollege_Demo.json` | 8 | 15 | 15 | 15 | 45 | 45 | 75 |
| **TEST Trust Demo** | `TEST_Trust_Demo` | Trust | `docs/15_Test_Data_Library/TEST_Trust_Demo.json` | 5 | 10 | 10 | 10 | 30 | 20 | 50 |
| **TEST Multi-Campus Demo** | `TEST_MultiCampus_Demo` | Multi-Campus | `docs/15_Test_Data_Library/TEST_MultiCampus_Demo.json` | 6 | 12 | 12 | 12 | 36 | 24 | 60 |
| **TEST Government School Demo** | `TEST_GovernmentSchool_Demo` | Government School | `docs/15_Test_Data_Library/TEST_GovernmentSchool_Demo.json` | 4 | 8 | 8 | 8 | 24 | 16 | 40 |
| **TEST Private School Demo** | `TEST_PrivateSchool_Demo` | Private School | `docs/15_Test_Data_Library/TEST_PrivateSchool_Demo.json` | 5 | 10 | 10 | 10 | 30 | 20 | 50 |
| **TEST Residential Campus Demo** | `TEST_ResidentialCampus_Demo` | Residential Campus | `docs/15_Test_Data_Library/TEST_ResidentialCampus_Demo.json` | 6 | 12 | 12 | 12 | 36 | 24 | 60 |

---

*Note: All data generated is completely synthetic/fake, utilizing randomized Indian names, phone numbers, and academic scores. No existing tenant data (including the `Suchitra Academy` tenant) was accessed, read, or modified.*
