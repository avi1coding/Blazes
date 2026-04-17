import { useState, useRef, useEffect } from 'react';

const SUBJECTS = [
  // Math
  'Math', 'Algebra 1', 'Algebra 2', 'Geometry', 'Trigonometry', 'Pre-Calculus', 'Calculus', 'AP Calculus AB', 'AP Calculus BC',
  'Statistics', 'AP Statistics', 'Probability', 'Arithmetic', 'Number Theory', 'Linear Algebra', 'Discrete Math', 'Multivariable Calculus',
  // Science
  'Science', 'Biology', 'AP Biology', 'Chemistry', 'AP Chemistry', 'Honors Chemistry', 'Organic Chemistry',
  'Physics', 'AP Physics 1', 'AP Physics 2', 'AP Physics C', 'Honors Physics',
  'Earth Science', 'Environmental Science', 'AP Environmental Science', 'Anatomy', 'Physiology', 'Human Biology',
  'Astronomy', 'Geology', 'Ecology', 'Genetics', 'Microbiology', 'Zoology', 'Botany', 'Marine Biology',
  'Forensic Science', 'Meteorology', 'Oceanography', 'Paleontology',
  // English & Language Arts
  'English', 'English 1', 'English 2', 'English 3', 'English 4', 'AP English Language', 'AP English Literature',
  'Literature', 'American Literature', 'British Literature', 'World Literature',
  'Grammar', 'Writing', 'Creative Writing', 'Expository Writing', 'Technical Writing',
  'Poetry', 'Journalism', 'Public Speaking', 'Debate', 'Speech', 'Communications',
  'Reading', 'Reading Comprehension', 'Vocabulary', 'Spelling', 'Phonics',
  // History & Social Studies
  'History', 'World History', 'US History', 'AP US History', 'AP World History', 'AP European History',
  'European History', 'Ancient History', 'Medieval History', 'Modern History',
  'American Government', 'AP Government', 'Civics', 'Political Science',
  'Economics', 'AP Economics', 'Microeconomics', 'AP Microeconomics', 'Macroeconomics', 'AP Macroeconomics',
  'Geography', 'AP Human Geography', 'World Geography',
  'African American Studies', 'Asian Studies', 'Latin American Studies', 'Middle Eastern Studies',
  'Civil War', 'American Revolution', 'Cold War', 'World War I', 'World War II',
  // Languages
  'Spanish 1', 'Spanish 2', 'Spanish 3', 'AP Spanish', 'Spanish',
  'French 1', 'French 2', 'French 3', 'AP French', 'French',
  'German', 'AP German', 'Mandarin', 'Chinese', 'Japanese', 'Korean',
  'Italian', 'Portuguese', 'Latin', 'Arabic', 'Russian', 'Hindi', 'Hebrew',
  'Sign Language', 'ASL', 'ESL', 'ELL',
  // Arts
  'Art', 'Studio Art', 'AP Studio Art', 'Drawing', 'Painting', 'Sculpture', 'Ceramics', 'Printmaking',
  'Photography', 'Digital Photography', 'Digital Art', 'Graphic Design', 'Animation',
  'Film Studies', 'Filmmaking', 'Video Production',
  'Music', 'Music Theory', 'AP Music Theory', 'Band', 'Concert Band', 'Jazz Band', 'Marching Band',
  'Orchestra', 'Strings', 'Choir', 'Vocal Music', 'Piano', 'Guitar',
  'Theater', 'Drama', 'Acting', 'Musical Theater', 'Dance', 'Ballet', 'Modern Dance',
  'Art History', 'AP Art History',
  // Computer Science & Technology
  'Computer Science', 'AP Computer Science A', 'AP Computer Science Principles',
  'Programming', 'Intro to Programming', 'Web Development', 'App Development',
  'Python', 'Java', 'JavaScript', 'C++', 'HTML/CSS', 'SQL',
  'Cybersecurity', 'Networking', 'IT', 'Information Technology',
  'Robotics', 'AI', 'Artificial Intelligence', 'Machine Learning', 'Data Science',
  'Game Design', 'Game Development', 'Digital Literacy', 'Typing', 'Computer Applications',
  '3D Modeling', '3D Printing',
  // Social Sciences
  'Psychology', 'AP Psychology', 'Sociology', 'Anthropology',
  'Philosophy', 'Ethics', 'Logic', 'Critical Thinking',
  'Criminal Justice', 'Law', 'Constitutional Law',
  // Business & Finance
  'Business', 'Intro to Business', 'Business Management', 'Business Law',
  'Accounting', 'Finance', 'Personal Finance', 'Investing',
  'Marketing', 'Entrepreneurship', 'Real Estate',
  // Engineering & STEM
  'Engineering', 'Intro to Engineering', 'Mechanical Engineering', 'Electrical Engineering',
  'Civil Engineering', 'Chemical Engineering', 'Biomedical Engineering',
  'Aerospace', 'Rocketry', 'Architecture', 'STEM',
  // Health & PE
  'Health', 'Health Education', 'Physical Education', 'PE', 'Fitness',
  'Nutrition', 'Sports Science', 'Kinesiology', 'First Aid', 'CPR',
  'Mental Health', 'Wellness', 'Sex Education', 'Drug Education',
  // Career & Technical
  'Agriculture', 'Horticulture', 'Animal Science', 'Veterinary Science',
  'Culinary Arts', 'Cooking', 'Baking', 'Food Science',
  'Fashion Design', 'Textiles', 'Interior Design',
  'Woodworking', 'Metalworking', 'Welding', 'Auto Shop', 'Automotive Technology',
  'Construction', 'Plumbing', 'Electrical Trade', 'HVAC',
  'Cosmetology', 'Childcare', 'Early Childhood Education',
  // Test Prep
  'SAT Prep', 'ACT Prep', 'GRE Prep', 'PSAT Prep', 'TOEFL Prep',
  'Test Prep', 'Study Skills', 'Homework Help', 'Tutoring',
  // Special Education
  'Special Education', 'Resource', 'Life Skills', 'Social Skills',
  // Religious Studies
  'Religion', 'Theology', 'Bible Studies', 'World Religions', 'Islamic Studies',
  // Military
  'JROTC', 'ROTC', 'Military Science',
  // Other
  'Homeroom', 'Advisory', 'Student Council', 'Leadership', 'Community Service',
  'Library Science', 'Media Studies', 'Yearbook', 'Newspaper',
  'Other',
];

const GRADE_LEVELS = [
  'Pre-K', 'Kindergarten',
  '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade',
  '6th Grade', '7th Grade', '8th Grade',
  '9th Grade', '10th Grade', '11th Grade', '12th Grade',
  'College Freshman', 'College Sophomore', 'College Junior', 'College Senior',
  'Graduate', 'Post-Graduate',
];

function SearchablePicker({ options, value, onChange, placeholder = 'Type or select...' }) {
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const ref = useRef(null);
  const listRef = useRef(null);

  useEffect(() => { setQuery(value || ''); }, [value]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query
    ? options.filter(s => s.toLowerCase().includes(query.toLowerCase()))
    : options;

  const handleSelect = (val) => {
    setQuery(val);
    onChange(val);
    setOpen(false);
    setHighlighted(-1);
  };

  const handleKeyDown = (e) => {
    if (!open) { if (e.key === 'ArrowDown') setOpen(true); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(prev => Math.min(prev + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(prev => Math.max(prev - 1, 0)); }
    else if (e.key === 'Enter' && highlighted >= 0) { e.preventDefault(); handleSelect(filtered[highlighted]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  useEffect(() => {
    if (highlighted >= 0 && listRef.current?.children[highlighted]) {
      listRef.current.children[highlighted].scrollIntoView({ block: 'nearest' });
    }
  }, [highlighted]);

  return (
    <div className="relative" ref={ref}>
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); setHighlighted(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none transition-colors bg-white text-sm"
      />
      {open && filtered.length > 0 && (
        <div ref={listRef} className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-xl max-h-72 overflow-y-auto">
          {filtered.map((s, i) => (
            <button key={s} type="button" onClick={() => handleSelect(s)}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                i === highlighted ? 'bg-red-50 text-red-700 font-bold' : 'text-gray-700 hover:bg-gray-50'
              } ${i === 0 ? 'rounded-t-xl' : ''} ${i === filtered.length - 1 ? 'rounded-b-xl' : ''}`}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SubjectPicker({ value, onChange, placeholder }) {
  return <SearchablePicker options={SUBJECTS} value={value} onChange={onChange} placeholder={placeholder || 'Type or select a subject...'} />;
}

export function GradePicker({ value, onChange, placeholder }) {
  return <SearchablePicker options={GRADE_LEVELS} value={value} onChange={onChange} placeholder={placeholder || 'Type or select a grade level...'} />;
}
