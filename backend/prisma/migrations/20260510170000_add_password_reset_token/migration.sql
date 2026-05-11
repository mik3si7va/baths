CREATE TABLE "password_reset_token" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "utilizador_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "used_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "password_reset_token_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_reset_token_token_hash_key" ON "password_reset_token"("token_hash");
CREATE INDEX "idx_password_reset_utilizador" ON "password_reset_token"("utilizador_id");

ALTER TABLE "password_reset_token"
ADD CONSTRAINT "fk_password_reset_utilizador"
FOREIGN KEY ("utilizador_id") REFERENCES "utilizador"("id")
ON DELETE CASCADE ON UPDATE NO ACTION;
