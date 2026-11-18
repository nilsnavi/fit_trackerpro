from pydantic import BaseModel, EmailStr, Field, field_validator


class EmailCodeRequest(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def normalize(cls, value: str) -> str:
        email = value.casefold()
        if len(email) > 254:
            raise ValueError("Email is too long")
        return email


class EmailChallengeResponse(BaseModel):
    challenge_id: str


class EmailCodeVerify(BaseModel):
    challenge_id: str = Field(pattern=r"^[a-f0-9]{32}$")
    code: str = Field(pattern=r"^[0-9]{6}$")
