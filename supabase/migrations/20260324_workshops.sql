-- Workshops table
CREATE TABLE workshops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Many-to-many: workshops <-> categories
CREATE TABLE workshop_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workshop_id, category_id)
);

-- Indexes for fast lookups
CREATE INDEX idx_workshop_categories_workshop ON workshop_categories(workshop_id);
CREATE INDEX idx_workshop_categories_menu_item ON workshop_categories(category_id);

-- Enable RLS
ALTER TABLE workshops ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_categories ENABLE ROW LEVEL SECURITY;

-- Policies: all authenticated users can read, head_office can write
CREATE POLICY "Authenticated users can read workshops"
  ON workshops FOR SELECT TO authenticated USING (true);

CREATE POLICY "Head office can manage workshops"
  ON workshops FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'head_office')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'head_office')
  );

CREATE POLICY "Authenticated users can read workshop_categories"
  ON workshop_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Head office can manage workshop_categories"
  ON workshop_categories FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'head_office')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'head_office')
  );
