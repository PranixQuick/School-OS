export interface TargetSchool {
  id: string
  name: string
  contactPerson: string
  role: string
  email: string
  phone: string
  lang: 'te' | 'en'
  district: string
  subjectInterest: string
  videoUrlPlaceholder?: string
}

export const targetSchools: TargetSchool[] = [
  {
    id: "ts-001",
    name: "Telangana Model School, Shadnagar",
    contactPerson: "Mr. K. Rama Rao",
    role: "Principal",
    email: "tmsshadnagar@example.com",
    phone: "+919515479595", // Founder number for testing
    lang: "te",
    district: "Rangareddy",
    subjectInterest: "Mathematics"
  },
  {
    id: "ts-002",
    name: "Zilla Parishad High School, Shamshabad",
    contactPerson: "Mrs. G. Sunitha",
    role: "Headmistress",
    email: "zphsshamshabad@example.com",
    phone: "+919515479595", // Founder number for testing
    lang: "te",
    district: "Rangareddy",
    subjectInterest: "General Science"
  },
  {
    id: "ts-003",
    name: "EdPro Academy, Gachibowli",
    contactPerson: "Dr. A. Srinivas",
    role: "Director",
    email: "srinivas@edproacademy.example.com",
    phone: "+919515479595", // Founder number for testing
    lang: "en",
    district: "Hyderabad",
    subjectInterest: "Bilingual Mathematics & Science"
  }
]
