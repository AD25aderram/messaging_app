package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/joho/godotenv"
)

type contact struct {
	Chat_id   int       `json:"chat_id"`
	ID        int       `json:"contact_id"`
	Username  string    `json:"username"`
	Message   string    `json:"last_message"`
	Etat      string    `json:"etat_du_message"`
	Date_sent time.Time `json:"date_du_message"`
}

func connect_to_database() *sql.DB {
	err := godotenv.Load()
	if err != nil {
		log.Fatalf("Error loading .env file: %v", err)
	}
	// MySQL DSN format: username:password@tcp(host:port)/dbname
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true",
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_HOST"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_NAME"))

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("Error opening database: %v", err)
	}

	err = db.Ping()
	if err != nil {
		log.Fatalf("Database connection failed: %v", err)
	}
	return db
}
func getcontacts(db *sql.DB, user_id int) []contact {

	var contacts []contact

	contact_rows, err := db.Query(`
		SELECT DISTINCT u.id, u.username
		FROM chats c
		JOIN users u
			ON u.id = CASE
				WHEN c.user1_id = ? THEN c.user2_id
				ELSE c.user1_id
			END
		WHERE ? IN (c.user1_id, c.user2_id)
	`, user_id, user_id)
	if err != nil {
		log.Fatalf("Error getting data from database: %v", err)
		return nil
	}
	defer contact_rows.Close()

	for contact_rows.Next() {
		var u contact
		// Scan the contact user id and username
		err1 := contact_rows.Scan(&u.ID, &u.Username)
		if err1 != nil {
			log.Fatal(err1)
		}

		var source string
		var etat string
		err2 := db.QueryRow(`
			SELECT c.chat_id, m.content, m.source, m.date_sent, m.etat
			FROM chats c
			LEFT JOIN messages m ON m.message_id = c.last_message_id
			WHERE (? IN (c.user1_id, c.user2_id) AND c.user2_id = ?)
			   OR (? IN (c.user1_id, c.user2_id) AND c.user1_id = ?)
			LIMIT 1
		`, user_id, u.ID, user_id, u.ID).Scan(&u.Chat_id, &u.Message, &source, &u.Date_sent, &etat)
		if err2 == sql.ErrNoRows {
			u.Chat_id = 0
			u.Message = ""
			u.Date_sent = time.Time{}
			u.Etat = ""
		} else if err2 != nil {
			log.Printf("errurr2 : %v", err2)
			continue
		} else {
			u.Date_sent = u.Date_sent.In(time.Local)
			if source == strconv.Itoa(u.ID) {
				u.Etat = etat
			} else {
				u.Etat = "mon_message"
			}
		}

		contacts = append(contacts, u)
	}

	if err = contact_rows.Err(); err != nil {
		log.Fatal(err)
	}
	return contacts
}
func main() {
	port := ":2500"

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:5173")
		w.Header().Set("Access-Control-Allow-Methods", "POST")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var payload struct {
			User_id int `json:"user_id"`
		}

		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		user_id := payload.User_id

		// Create the data object using the input
		db := connect_to_database()

		contacts := getcontacts(db, user_id)
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(contacts); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

	})
	fmt.Printf("Server is starting on port %s...\n", port)
	if err := http.ListenAndServe(port, nil); err != nil {
		fmt.Printf("Error starting server: %s\n", err)
	}

}
