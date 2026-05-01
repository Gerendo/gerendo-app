import os
import pickle
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/gmail.modify']

def authenticate_gmail():
    creds = None
    if os.path.exists("token.pickle"):
        with open("token.pickle", "rb") as token:
            creds = pickle.load(token)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file("credentials.json", SCOPES)
            creds = flow.run_local_server(port=0)
        with open("token.pickle", "wb") as token:
            pickle.dump(creds, token)

    return build('gmail', 'v1', credentials=creds)

service = authenticate_gmail()

# List all labels
results = service.users().labels().list(userId='me').execute()
labels = results.get('labels', [])

print("\n=== YOUR GMAIL LABELS ===\n")
for label in labels:
    print(f"Name: {label['name']}")
    print(f"ID:   {label['id']}")
    print("-" * 40)
