CREATE TABLE IF NOT EXISTS issues (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  description VARCHAR(500) NOT NULL,
  category VARCHAR(40) NOT NULL,
  location VARCHAR(100) NOT NULL,
  priority VARCHAR(10) NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
  status VARCHAR(20) NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO issues (title, description, category, location, priority, status)
SELECT 'Wi-Fi keeps dropping in the library', 'The connection disconnects every few minutes on the second floor.', 'Internet', 'Main Library · Floor 2', 'High', 'In Progress'
WHERE NOT EXISTS (SELECT 1 FROM issues);

INSERT INTO issues (title, description, category, location, priority, status)
SELECT 'Projector is not turning on', 'The lecture hall projector does not respond to the power button.', 'Classroom', 'Block B · Room 204', 'Medium', 'Open'
WHERE (SELECT COUNT(*) FROM issues) = 1;

INSERT INTO issues (title, description, category, location, priority, status)
SELECT 'Water cooler needs a refill', 'The cooler near the student lounge is empty.', 'Facilities', 'Student Centre · Ground Floor', 'Low', 'Resolved'
WHERE (SELECT COUNT(*) FROM issues) = 2;