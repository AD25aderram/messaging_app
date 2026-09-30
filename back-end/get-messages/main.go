package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/joho/godotenv"
)

type message struct {
	Content   string    `json:"content"`
	Date_sent time.Time `json:"date_du_message"`
	Source    int       `json:"sent_by_id"`
	Etat      string    `json:"etat_du message"`
}

func connect_to_database() *sql.DB {
	err := godotenv.Load()
	if err != nil {
		log.Fatal("erreur in the .env file", err)
	}
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
func get_messages(db *sql.DB, chat_id int) []message {

	var messages []message

	rows, err := db.Query("SELECT content, source, date_sent, etat FROM messages WHERE chat_id = ?", chat_id)
	if err != nil {
		log.Fatal("enable to get messages from db : ", err)
	}
	defer rows.Close()

	for rows.Next() {
		var m message
		err1 := rows.Scan(&m.Content, &m.Source, &m.Date_sent, &m.Etat)
		if err1 != nil {
			log.Fatal("can read rows values : ", err1)
		}
		m.Date_sent = m.Date_sent.In(time.Local)
		messages = append(messages, m)
	}
	return messages
}
func main() {
	port := ":2600"

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:5173")
		w.Header().Set("Access-Control-Allow-Methods", "GET")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var payload struct {
			Chat_id int `json:"chat_id"`
		}

		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		chat_id := payload.Chat_id

		// Create the data object using the input
		db := connect_to_database()

		messages := get_messages(db, chat_id)
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(messages); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

	})
	fmt.Printf("Server is starting on port %s...\n", port)
	if err := http.ListenAndServe(port, nil); err != nil {
		fmt.Printf("Error starting server: %s\n", err)
	}
}
