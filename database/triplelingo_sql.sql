CREATE DATABASE IF NOT EXISTS triplelingodb;
USE triplelingodb;
-- DROP TABLE IF EXISTS users;
-- DROP TABLE IF EXISTS scripts;

-- 1. Create the user management platform profile framework table
CREATE TABLE IF NOT EXISTS users (
    user_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50),
    nickname VARCHAR(50),
    email VARCHAR(100) UNIQUE, -- Added UNIQUE constraint to match registration rules
    password VARCHAR(255),
    login_type VARCHAR(50),
    profile_image VARCHAR(255),
    status VARCHAR(50) DEFAULT 'ACTIVE', -- Added status tracker field to match main.py checks
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    social_provider VARCHAR(50),
    social_id VARCHAR(100)
);

-- 2. Create the practice scenario dialog scripts data logging table
CREATE TABLE IF NOT EXISTS scripts (
    script_id INT NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL DEFAULT 1,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (script_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 3. Ingest sandbox user profiles rows
INSERT INTO users 
(name, nickname, email, password, login_type, status, profile_image, social_provider, social_id)
VALUES
('홍길동', '길동이', 'hong@example.com', '12345678', 'LOCAL', 'ACTIVE', NULL, NULL, NULL),
('김철수', '철수', 'kim@example.com', '12345678', 'LOCAL', 'ACTIVE', NULL, NULL, NULL),
('관리자', '어드민', 'admin@example.com', 'admin1234', 'LOCAL', 'ACTIVE', NULL, NULL, NULL), -- Added to match your admin user layout checks
('이소셜', '소셜유저', 'social@example.com', NULL, 'SOCIAL', 'ACTIVE', NULL, 'KAKAO', 'kakao_12345');


INSERT INTO scripts (user_id, title, content)
VALUES
(
1,
'Romeo and Juliet - Balcony Scene',
'Romeo: But, soft! What light through yonder window breaks?
Juliet: O Romeo, Romeo! Wherefore art thou Romeo?
Romeo: Shall I hear more, or shall I speak at this?
Juliet: Deny thy father and refuse thy name.
Romeo: I take thee at thy word.'
),

(
1,
'The Importance of Being Earnest',
'Jack: I am in love with Gwendolen.
Algernon: I thought you had come up for pleasure.
Jack: I call that business.
Algernon: How utterly unromantic you are!'
),

(
1,
'Emotion Practice Script',
'Alex: I cannot believe how wonderful this day has turned out to be!
Sara: You always say that, but today truly does feel special.
Alex: Wait, did you hear that? Something is out there in the dark.
Sara: I heard it too. My heart is pounding so fast right now.
Alex: Oh my goodness! I never expected to see you here like this!
Sara: I know! This is the last place I ever thought we would meet.
Alex: How could you do this to me? After everything we have been through!
Sara: I did not mean to hurt you. I was just trying to protect us both.
Alex: I miss the way things used to be between us. It breaks my heart.
Sara: Me too. Those memories are all I have left to hold onto now.
Alex: The smell of that rotten food is absolutely making me sick.
Sara: I completely agree. I cannot stand being near it for another second.
Alex: So, shall we head home now? It has been quite a long day.
Sara: Yes, let us go. I could really use some rest after all of this.'
);

INSERT INTO scripts (user_id, title, content)
VALUES (
    1,
    'The Devil Wears Prada - Miranda & Emily',
    'Miranda: I don''t understand why it''s so difficult to confirm an appointment.
Emily: I know. I''m so sorry, Miranda. I actually did confirm last night.
Miranda: Details of your incompetence do not interest me. Tell Simone I''m not going to approve that girl that she sent me for the Brazilian layout. I asked for clean, athletic, smiling. She sent me dirty, tired and paunchy.
Miranda: And RSVP yes to the Michael Kors party. I want the driver to drop me off at 9:30 and pick me up at 9:45 sharp.
Emily: 9:45 sharp.
Miranda: Call Natalie at Glorious Foods, tell her no for the 40th time. No, I don''t want dacquoise. I want tortes filled with warm rhubarb compote. Then call my ex-husband and remind him the parent-teacher conference is at Dalton tonight. Then call my husband, ask him to meet me for dinner at that place I went to with Massimo.
Miranda: Also, tell Richard I saw the pictures that he sent for that feature on the female paratroopers, and they''re all so deeply unattractive. Is it impossible to find a lovely, slender female paratrooper?
Emily: No.
Miranda: Am I reaching for the stars here? Not really. Also, I need to see all the things that Nigel has pulled for Gwyneth''s second cover try. I wonder if she''s lost any of that weight yet. Who''s that?
Emily: Nobody. Well, Human Resources sent her up about the new assistant job, and I was preinterviewing her for you. But she''s hopeless and totally wrong for it.
Miranda: Clearly I''m going to have to do that myself because the last two you sent me were completely inadequate. So send her in. That''s all.
Emily: Right.'
);

-- 1. Insert Script 1: Job Interview (면접 인터뷰)
INSERT INTO scripts (user_id, title, content)
VALUES (
    1,
    'Job Interview Practice',
    'Interviewer: Hello. Nice to meet you. Please have a seat.
Applicant: Hello. Nice to meet you, too. Thank you for having me.
Interviewer: Could you please introduce yourself?
Applicant: Sure. My name is Alex. I am a responsible and hardworking person. I enjoy learning new things and meeting new people. I am also a good listener and I always try to do my best. I am very happy to have this opportunity today.
Interviewer: Why are you interested in this position?
Applicant: I am interested in this position because I think it matches my interests and strengths. I also want to learn new skills and gain valuable experience.
Interviewer: What are your strengths?
Applicant: I think my biggest strength is that I am responsible. When I start something, I always try to finish it properly. I am also patient and I work well with other people.
Interviewer: What is your weakness?
Applicant: Sometimes I worry too much about making mistakes. But I am trying to overcome this by preparing carefully and staying positive.
Interviewer: How do you handle stressful situations?
Applicant: I try to stay calm and focus on the most important things first. I make a plan and solve each problem step by step.
Interviewer: Do you prefer working alone or working with a team?
Applicant: I can do both, but I enjoy working with a team. I like sharing ideas and helping each other. I think teamwork can lead to better results.
Interviewer: Tell me about a difficult situation you experienced.
Applicant: Once, I had to finish an important task in a short amount of time. At first, I was nervous, but I made a plan and focused on one task at a time. In the end, I finished it successfully. It taught me the importance of staying calm and managing my time.
Interviewer: Where do you see yourself in five years?
Applicant: In five years, I hope to be more experienced and confident in my field. I want to continue learning and take on more responsibilities.
Interviewer: Why should we choose you?
Applicant: I am responsible, hardworking, and willing to learn. I may not know everything yet, but I learn quickly and always try to improve. I believe I can contribute positively to the team.
Interviewer: Do you have any questions for me?
Applicant: Yes. Could you tell me more about the position and what a typical day would be like?
Interviewer: Of course. You would be collaborating with our engineering team on core features and daily scrums.
Applicant: I see. Thank you for explaining that.
Interviewer: Do you have anything else you would like to say?
Applicant: I would just like to say thank you for giving me this opportunity. I really enjoyed speaking with you today, and I hope to have the chance to work with you.
Interviewer: Thank you for coming today.
Applicant: Thank you for your time. Have a great day.
Interviewer: You too. Goodbye.
Applicant: Goodbye.'
);

-- 2. Insert Script 2: Topic Speaking Interview (토픽 스피킹 인터뷰)
INSERT INTO scripts (user_id, title, content)
VALUES (
    1,
    'Topic Speaking Interview (OPIc)',
    'Examiner: Let us start the interview. Please introduce yourself.
Student: Hi, my name is Alex. I am from Korea. I am currently working as a software developer. In my free time, I like watching movies, listening to music, and hanging out with my friends. I am a little nervous today, but I will do my best.
Examiner: What do you usually do in your free time?
Student: I usually watch YouTube or movies at home. Sometimes, I go to a café and meet my friends. I also enjoy listening to music because it helps me relax.
Examiner: What is your favorite place to visit?
Student: My favorite place is a café near my home. It is quiet and comfortable, so I often go there when I want to relax. I usually drink coffee and listen to music there.
Examiner: How often do you go to cafés?
Student: I go to cafés about two or three times a week. Usually, I go there on weekends, but sometimes I visit a café after work.
Examiner: Who do you usually go with?
Student: I usually go with my friends. We talk about our daily lives and sometimes take pictures. I enjoy spending time with them.
Examiner: Tell me about the last time you went to a café.
Student: Last weekend, I went to a café with my friend. We ordered coffee and cake and talked for about two hours. The weather was nice, so we also took a walk afterward. It was a really relaxing day.
Examiner: Do you prefer staying at home or going out?
Student: I prefer going out because I like meeting people and trying new things. However, when I am tired, I prefer staying home and watching movies.
Examiner: What kind of movies do you like?
Student: I like comedy and action movies. I especially enjoy comedy movies because they make me laugh and help me forget about stress.
Examiner: How often do you watch movies?
Student: I usually watch movies once or twice a week. I mostly watch them at home because it is more comfortable and convenient.
Examiner: Tell me about a movie you watched recently.
Student: I watched a comedy movie recently. It was really funny and entertaining. My favorite part was when the main character got into a funny situation. I really enjoyed it.
Examiner: Now, imagine that your friend wants to watch a movie with you. What would you suggest?
Student: I would suggest watching a comedy movie. I think it would be fun and relaxing. We could watch it at my place and order some food.
Examiner: Your friend says the movie is too expensive. What would you do?
Student: I would suggest watching a movie at home instead. We could use a streaming service, and it would be much cheaper. We could also order pizza and enjoy the movie together.
Examiner: Do you prefer watching movies alone or with other people?
Student: I prefer watching movies with other people. It is more fun because we can talk about the movie and share our opinions. But sometimes I watch movies alone when I want some quiet time.
Examiner: Thank you. That is the end of the interview.
Student: Thank you. It was nice talking with you.'
);

-- 1. Insert Script: Talking with a Friend (친구와 대화)
INSERT INTO scripts (user_id, title, content)
VALUES (
    1,
    'Daily Conversation - Meeting a Friend',
    'Mia: Hey, Jake! Sorry I''m late.
Jake: Mia! What happened? I''ve been waiting for almost thirty minutes.
Mia: I know, I know. I''m really sorry. I overslept this morning.
Jake: You overslept? Again?
Mia: Unfortunately, yes. I set three alarms, but somehow, I slept through all of them.
Jake: Three alarms? How is that even possible?
Mia: I honestly have no idea. When I finally woke up and looked at the clock, I almost had a heart attack.
Jake: Haha, I can imagine your face.
Mia: It wasn''t funny at the time! I was running around my apartment trying to find my keys, my phone, and my wallet.
Jake: And then what happened?
Mia: Then, just when I thought everything was okay, I got stuck in traffic.
Jake: Oh, that''s the worst.
Mia: Exactly! I was sitting in the car thinking, "Why is this happening to me today?"
Jake: I was actually starting to worry about you. You weren''t answering your phone.
Mia: I''m sorry about that. My phone battery died.
Jake: Your phone died too? Wow. You really had a rough morning.
Mia: Don''t remind me. I was so stressed out.
Jake: Well, at least you''re here now.
Mia: Yeah. Honestly, I''m just relieved to see you.
Jake: Same here. I''m glad you''re okay.
Mia: Thanks for waiting for me. I really appreciate it.
Jake: No problem. Let''s just enjoy the day now.
Mia: Definitely. And I promise I''ll be on time next time.'
);

-- 2. Insert Script: At a Café (카페에서)
INSERT INTO scripts (user_id, title, content)
VALUES (
    1,
    'Daily Conversation - At a Cafe',
    'Staff: Here''s your order. One chicken sandwich and one iced latte. Enjoy!
Sophie: Thank you! Wait... this isn''t what I ordered.
Staff: Oh, really? What did you order?
Sophie: I ordered a tuna sandwich, not a chicken sandwich.
Staff: Oh, I''m so sorry. I must have made a mistake.
Sophie: Hmm... I''m a little disappointed. I''ve been waiting for this for a long time.
Staff: I completely understand. I''m really sorry about that. I''ll get you the tuna sandwich right away.
Sophie: Okay, but could you please make it quickly? I have to leave soon.
Staff: Of course. It will only take a few minutes.'
);

-- 3. Insert Script: Shopping for Clothes (쇼핑할 때)
INSERT INTO scripts (user_id, title, content)
VALUES (
    1,
    'Daily Conversation - Shopping for Clothes',
    'Sarah: Wow, look at this jacket! It''s so beautiful.
Friend: Oh, yeah. That looks really good on you.
Sarah: I love it. I''ve been looking for a jacket like this for months.
Friend: Then try it on.
Sarah: Okay. Hmm… It fits perfectly!
Friend: See? You should buy it.
Sarah: I think I will. Let me check the price.
Friend: How much is it?
Sarah: Oh my gosh.
Friend: What?
Sarah: It''s three hundred dollars!
Friend: Three hundred?! That''s expensive.
Sarah: I know. I really want it, but I can''t spend that much money on a jacket.
Friend: Maybe there''s a discount.
Sarah: Let me ask the salesperson. Excuse me. Is this jacket on sale?
Staff: Actually, it''s 30% off today.
Sarah: Really?!
Staff: Yes. The original price is three hundred dollars, so today it''s two hundred ten.
Sarah: Hmm… That''s still a lot of money.
Friend: But you really like it.
Sarah: I know. This is so hard.
Friend: Think about it. If you buy it, will you regret spending the money?
Sarah: Probably.
Friend: And if you don''t buy it, will you regret leaving it here?
Sarah: Definitely!
Friend: Then I think you already know the answer.
Sarah: You''re right… But I should be responsible.
Friend: Good decision.
Sarah: Okay, I''m going to put it back.
Friend: Are you sure?
Sarah: Yes. I''ll save some money and come back later.
Staff: That sounds like a good plan.
Sarah: Wait! I just saw something.
Friend: What?
Sarah: There''s another jacket over there, and it''s only fifty dollars!
Friend: No way!
Sarah: And it looks pretty good too!
Friend: Try it on!
Sarah: Okay. Maybe today is my lucky day after all.'
);


-- 5. Run diagnostic execution validations
SELECT * FROM users;
SELECT script_id, title, CHAR_LENGTH(content) AS script_character_count FROM scripts;



USE triplelingodb;

CREATE TABLE IF NOT EXISTS practice_results (
    result_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    script_id INT NOT NULL,
    role_name VARCHAR(100),
    

    score INT NOT NULL,
    accuracy_score INT,
    fluency_score INT,
    pronunciation_score INT,

    practiced_lines INT DEFAULT 0,
    practiced_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

DESC practice_results;




USE triplelingodb;

SELECT *
FROM practice_results;

DELETE FROM practice_results
WHERE result_id = 1;